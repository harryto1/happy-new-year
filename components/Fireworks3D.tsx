"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Pusher from "pusher-js";

type Firework = {
  mesh: THREE.Points;
  velocities: Float32Array;
  life: number;
  trailMeshes: THREE.Mesh[];
  priority: number; // For garbage collection
};

type Rocket = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  targetY: number;
  trail: THREE.Mesh;
  trailPositions: THREE.Vector3[];
};

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Calculate scale and opacity based on distance
function getFireworkScale(distanceKm: number): { scale: number; opacity: number; zOffset: number } {
  // Local (0-50km): Full size, full brightness
  if (distanceKm < 50) {
    return { scale: 1.0, opacity: 1.0, zOffset: 0 };
  }
  // Nearby (50-200km): Slightly smaller
  else if (distanceKm < 200) {
    return { scale: 0.8, opacity: 0.9, zOffset: -10 };
  }
  // Regional (200-1000km): Medium distance
  else if (distanceKm < 1000) {
    return { scale: 0.65, opacity: 0.75, zOffset: -20 };
  }
  // Country (1000-3000km): Small
  else if (distanceKm < 3000) {
    return { scale: 0.45, opacity: 0.6, zOffset: -30 };
  }
  // Continental (3000-8000km): Very small
  else if (distanceKm < 8000) {
    return { scale: 0.35, opacity: 0.45, zOffset: -40 };
  }
  // Global (8000km+): Tiny, pale
  else {
    return { scale: 0.175, opacity: 0.3, zOffset: -50 };
  }
}

export default function FireworksOnlyCursor() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fireworks = useRef<Firework[]>([]);
  const rockets = useRef<Rocket[]>([]);
  const clientId = useRef<string>(Math.random().toString(36).substring(7));
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Performance caps
  const MAX_FIREWORKS = 15; // Maximum simultaneous firework explosions
  const MAX_ROCKETS = 10; // Maximum rockets in flight
  const MAX_PARTICLES_PER_FIREWORK = 40; // Reduced from 60

  // Get user's location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to a default location if user denies
          setUserLocation({ latitude: 0, longitude: 0 });
        }
      );
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !userLocation) return;

    let isTabVisible = true; 

    // Initialize Pusher
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channelName = process.env.NODE_ENV === 'production' 
        ? 'fireworks-channel-production' 
        : 'fireworks-channel-development';
    const channel = pusher.subscribe(channelName);

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 50;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    containerRef.current.appendChild(renderer.domElement);

    // === AUDIO SETUP ===
    const audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    const audioLoader = new THREE.AudioLoader();

    const launchSound = new THREE.Audio(audioListener);
    const explosionSound = new THREE.Audio(audioListener);

    const masterVolumeRef = { current: 0.7 }; // Use ref object instead of variable

    if (typeof window !== "undefined") {
      const savedVolume = localStorage.getItem("fireworks-volume");
      const savedMuted = localStorage.getItem("fireworks-muted");

      if (savedVolume && savedMuted !== "true") {
        masterVolumeRef.current = parseInt(savedVolume) / 100;
      } else if (savedMuted === "true") {
        masterVolumeRef.current = 0;
      }

      (window as any).setMasterVolume = (vol: number) => {
        masterVolumeRef.current = vol; 
      };
    }

    audioLoader.load('/sounds/rocket-launch.mp3', (buffer) => {
      launchSound.setBuffer(buffer);
      launchSound.setVolume(0.5);
    });

    audioLoader.load('/sounds/explosion.mp3', (buffer) => {
      explosionSound.setBuffer(buffer);
      explosionSound.setVolume(0.7);
    });

    const playSound = (sound: THREE.Audio, volume: number = 1.0) => {
      if (!isTabVisible) return;
      if (masterVolumeRef.current === 0) return; 

      const context = audioListener.context; 
      if (context.state === 'suspended') {
        context.resume();
      }

      // Always clone to avoid volume conflicts
      const clone = sound.clone();
      const baseVolume = sound.getVolume();
      clone.setVolume(baseVolume * volume * masterVolumeRef.current);
      clone.play();
      
      // Clean up clone after it finishes
      clone.onEnded = () => {
        clone.disconnect();
      };
    };

    const stopSound = (sound: THREE.Audio) => {
        if (sound.isPlaying) {
            sound.stop();
        }
    }

    const stopAllSounds = () => {
      stopSound(launchSound);
      stopSound(explosionSound);
    }

    // Clear all fireworks and rockets 
    const clearAllFireworks = () => {
      fireworks.current.forEach(fw => {
        scene.remove(fw.mesh);
        fw.mesh.geometry.dispose(); 
        (fw.mesh.material as THREE.Material).dispose();

        const sharedMaterial = fw.trailMeshes[0]?.material;
        fw.trailMeshes.forEach(tm => {
          scene.remove(tm);
          tm.geometry.dispose(); 
        });
        if (sharedMaterial) {
          (sharedMaterial as THREE.Material).dispose();
        }
      }); 
      fireworks.current = [];

      // Clear all rockets
      rockets.current.forEach(rocket => {
        scene.remove(rocket.mesh);
        scene.remove(rocket.trail);
        rocket.mesh.geometry.dispose(); 
        (rocket.mesh.material as THREE.Material).dispose();
        rocket.trail.geometry.dispose();
        (rocket.trail.material as THREE.Material).dispose();
      });
      rockets.current = [];
    };

    // Helper function to handle minimizing the tab
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isTabVisible = false;
        stopAllSounds();
        clearAllFireworks();
      } else {
        isTabVisible = true;
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // === STARS ===
    const starCount = 500; // Reduced from 800
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 300;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 150;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 100 - 50;
      
      starSizes[i] = Math.random() * 8 + 3;
      
      const color = new THREE.Color();
      color.setHSL(0.6, Math.random() * 0.3, 0.9 + Math.random() * 0.1);
      starColors[i * 3] = color.r;
      starColors[i * 3 + 1] = color.g;
      starColors[i * 3 + 2] = color.b;
    }

    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("size", new THREE.BufferAttribute(starSizes, 1));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float twinkle = sin(time * (0.5 + position.x * 0.01) + position.y) * 0.3 + 0.8;
          gl_PointSize = size * twinkle;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center) * 2.0;
          float glow1 = 1.0 - smoothstep(0.0, 0.4, dist);
          float glow2 = 1.0 - smoothstep(0.0, 0.8, dist);
          float glow3 = 1.0 - smoothstep(0.0, 1.0, dist);
          float strength = glow1 * 1.0 + glow2 * 0.5 + glow3 * 0.3;
          float core = 1.0 - smoothstep(0.0, 0.15, dist);
          strength = max(strength, core);
          gl_FragColor = vec4(vColor * (1.0 + strength * 0.5), strength);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // Reusable geometries - no cache needed, create once
    const rocketGeometry = new THREE.SphereGeometry(0.2, 6, 6); // Reduced segments from 8,8

    // Garbage collector for fireworks
    const cleanupOldFireworks = () => {
      if (fireworks.current.length <= MAX_FIREWORKS) return;

      // Sort by priority (lower = remove first) and age (life)
      fireworks.current.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.life - b.life;
      });

      // Remove excess fireworks
      const toRemove = fireworks.current.length - MAX_FIREWORKS;
      for (let i = 0; i < toRemove; i++) {
        const fw = fireworks.current[i];
        scene.remove(fw.mesh);
        fw.mesh.geometry.dispose();
        (fw.mesh.material as THREE.Material).dispose();

        const sharedMaterial = fw.trailMeshes[0]?.material;
        fw.trailMeshes.forEach(tm => {
          scene.remove(tm);
          tm.geometry.dispose();
        });
        if (sharedMaterial) {
          (sharedMaterial as THREE.Material).dispose();
        }
      }

      fireworks.current = fireworks.current.slice(toRemove);
    };

    // Garbage collector for rockets
    const cleanupOldRockets = () => {
      if (rockets.current.length <= MAX_ROCKETS) return;

      const toRemove = rockets.current.length - MAX_ROCKETS;
      for (let i = 0; i < toRemove; i++) {
        const rocket = rockets.current[i];
        scene.remove(rocket.mesh);
        scene.remove(rocket.trail);
        rocket.mesh.geometry.dispose();
        (rocket.mesh.material as THREE.Material).dispose();
        rocket.trail.geometry.dispose();
        (rocket.trail.material as THREE.Material).dispose();
      }

      rockets.current = rockets.current.slice(toRemove);
    };

    // Launch rocket with distance-based scaling
    const launchRocket = (targetX: number, targetY: number, color?: THREE.Color, scale: number = 1.0, opacity: number = 1.0, zOffset: number = 0) => {
      // Don't launch if tab is hidden
      if (!isTabVisible) return color || new THREE.Color().setHSL(Math.random(), 1, 0.6);
      
      // Check rocket cap
      if (rockets.current.length >= MAX_ROCKETS) {
        cleanupOldRockets();
      }

      const rocketColor = color || new THREE.Color().setHSL(Math.random(), 1, 0.6);

      // Only play sound for close fireworks to reduce audio overhead
      if (opacity > 0.5) {
        playSound(launchSound, opacity);
      }

      const geometry = rocketGeometry.clone();
      geometry.scale(scale, scale, scale);
      
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00,
        transparent: true,
        opacity: opacity,
      });
      
      const rocket = new THREE.Mesh(geometry, material);
      const bottomY = -30;
      rocket.position.set(targetX, bottomY, zOffset);
      
      const speed = 1.2 * Math.max(scale, 0.8);
      const driftX = (Math.random() - 0.5) * 0.15 * scale;
      const driftZ = (Math.random() - 0.5) * 0.1 * scale;
      const velocity = new THREE.Vector3(driftX, speed, driftZ);

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(targetX, bottomY, zOffset),
        new THREE.Vector3(targetX, bottomY, zOffset),
      ]);

      const tubeGeometry = new THREE.TubeGeometry(curve, 4, 0.08 * scale, 3, false); // Reduced segments
      const tubeMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.6 * opacity,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      const trail = new THREE.Mesh(tubeGeometry, tubeMaterial);
      scene.add(rocket);
      scene.add(trail);

      rockets.current.push({ 
        mesh: rocket, 
        velocity,
        targetY,
        trail,
        trailPositions: [rocket.position.clone()],
      });

      (rocket as any).fireworkColor = rocketColor;
      (rocket as any).fireworkScale = scale;
      (rocket as any).fireworkOpacity = opacity;
      return rocketColor; 
    };

    // Explosion with distance-based scaling
    const explode = (x: number, y: number, z: number, color?: THREE.Color, scale: number = 1.0, opacity: number = 1.0) => {
      // Dont explode if tab is hidden
      if (!isTabVisible) return;
      
      // Check firework cap before creating new one
      if (fireworks.current.length >= MAX_FIREWORKS) {
        cleanupOldFireworks();
      }

      stopSound(launchSound);
      
      // Only play sound for close fireworks
      if (opacity > 0.5) {
        playSound(explosionSound, opacity);
      }
      
      // Reduce particle count based on scale and distance
      const baseCount = Math.min(MAX_PARTICLES_PER_FIREWORK, Math.floor(60 * scale));
      const count = Math.max(baseCount, 15); // Minimum 15 particles
      
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = (Math.random() * 0.6 + 0.3) * scale;

        velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
        velocities[i * 3 + 2] = Math.cos(phi) * speed * 0.3;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const particleColor = color || new THREE.Color().setHSL(Math.random(), 1, 0.6);

      const adjustedColor = particleColor.clone();
      if (opacity < 1.0) {
        const hsl = { h: 0, s: 0, l: 0 };
        adjustedColor.getHSL(hsl);
        adjustedColor.setHSL(
          hsl.h,
          hsl.s * (0.3 + opacity * 0.7),
          Math.min(hsl.l + (1 - opacity) * 0.3, 0.9)
        );
      }

      const material = new THREE.PointsMaterial({
        size: 0.35 * Math.max(scale, 0.6),
        transparent: true,
        opacity: opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: adjustedColor,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      const trailMeshes: THREE.Mesh[] = [];
      
      const sharedTrailMaterial = new THREE.MeshBasicMaterial({
        color: adjustedColor,
        transparent: true,
        opacity: 0.5 * opacity,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      // Reduce trail count for distant fireworks
      const trailCount = Math.floor(count * Math.max(scale, 0.3));
      
      for (let i = 0; i < trailCount; i++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(x, y, z),
        ]);

        const tubeGeometry = new THREE.TubeGeometry(curve, 3, 0.04 * scale, 3, false); // Reduced segments

        const trailMesh = new THREE.Mesh(tubeGeometry, sharedTrailMaterial);
        trailMesh.frustumCulled = true;
        scene.add(trailMesh);
        trailMeshes.push(trailMesh);

        (trailMesh as any).particleHistory = [new THREE.Vector3(x, y, z)];
      }

      // Priority based on scale/opacity - higher priority = kept longer
      const priority = Math.floor(scale * 10 + opacity * 10);

      fireworks.current.push({ 
        mesh: points, 
        velocities, 
        life: 100,
        trailMeshes,
        priority,
      });

      (points as any).fireworkScale = scale;
      (points as any).fireworkOpacity = opacity;
    };

    const getClickWorldPosition = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const point = new THREE.Vector3();
      raycaster.ray.intersectPlane(clickPlane, point);
      return point;
    };

    const handleClick = async (e: MouseEvent) => {
      const worldPos = getClickWorldPosition(e);
      const normalizedX = (worldPos.x + 150) / 300;
      const normalizedY = (worldPos.y + 75) / 150;
      const color = launchRocket(worldPos.x, worldPos.y);

      try {
        await fetch("/api/firework", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              x: normalizedX, 
              y: normalizedY, 
              clientId: clientId.current, 
              color: color.getHex(),
              latitude: userLocation.latitude,
              longitude: userLocation.longitude
            }),
        });
      } catch (error) {
        console.log('Failed to trigger firework: ', error);
      }
    };

    channel.bind('new-firework', (data: { x:number; y:number; clientId: string; color: number; latitude?: number; longitude?: number }) => {
        if (data.clientId === clientId.current) return;
        if (!isTabVisible) return;
        
        const worldX = data.x * 300 - 150;
        const worldY = data.y * 150 - 75;
        const color = new THREE.Color(data.color);
        
        // Calculate distance and scale
        let scale = 1.0;
        let opacity = 1.0;
        let zOffset = 0;

        if (data.latitude && data.longitude) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            data.latitude,
            data.longitude
          );
          const scaleData = getFireworkScale(distance);
          scale = scaleData.scale;
          opacity = scaleData.opacity;
          zOffset = scaleData.zOffset;
        }
        
        launchRocket(worldX, worldY, color, scale, opacity, zOffset);
    });

    channel.bind('happy-new-year', () => {
      if (!isTabVisible) return;

      const fireworkCount = 15; // Reduced from 20
      const centerY = 0;
      
      for (let i = 0; i < fireworkCount; i++) {
        setTimeout(() => {
          const randomX = (Math.random() - 0.5) * 200;
          const color = new THREE.Color().setHSL(Math.random(), 1, 0.6);
          launchRocket(randomX, centerY, color);
        }, i * 150); // Slightly longer delay
      }
    });

    window.addEventListener("click", handleClick);

    let frameCount = 0;
    let animationFrameId: number; 

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Pause animation when tab is hidden
      if (!isTabVisible) return;

      const time = Date.now() * 0.001;
      frameCount++;

      starMaterial.uniforms.time.value = time;

      rockets.current.forEach((rocket, i) => {
        rocket.velocity.y -= 0.0005;
        rocket.velocity.x += (Math.random() - 0.5) * 0.2;
        rocket.velocity.z += (Math.random() - 0.5) * 0.1;
        rocket.mesh.position.add(rocket.velocity);

        rocket.trailPositions.push(rocket.mesh.position.clone());
        const maxTrailLength = 5;
        if (rocket.trailPositions.length > maxTrailLength) {
          rocket.trailPositions.shift();
        }

        if (rocket.trailPositions.length >= 2 && frameCount % 2 === 0) {
          const curve = new THREE.CatmullRomCurve3(rocket.trailPositions);
          rocket.trail.geometry.dispose();
          rocket.trail.geometry = new THREE.TubeGeometry(curve, Math.min(rocket.trailPositions.length, 4), 0.08, 3, false); // Reduced segments
        }

        if (rocket.mesh.position.y >= rocket.targetY || rocket.velocity.y < 0) {
          const storedColor = (rocket.mesh as any).fireworkColor;
          const storedScale = (rocket.mesh as any).fireworkScale || 1.0;
          const storedOpacity = (rocket.mesh as any).fireworkOpacity || 1.0;
          explode(rocket.mesh.position.x, rocket.mesh.position.y, rocket.mesh.position.z, storedColor, storedScale, storedOpacity);
          
          scene.remove(rocket.mesh);
          scene.remove(rocket.trail);
          rocket.mesh.geometry.dispose();
          (rocket.mesh.material as THREE.Material).dispose();
          rocket.trail.geometry.dispose();
          (rocket.trail.material as THREE.Material).dispose();
          rockets.current.splice(i, 1);
        }
      });

      fireworks.current.forEach((fw, i) => {
        const pos = fw.mesh.geometry.attributes.position.array as Float32Array;
        const particleCount = pos.length / 3;

        const needsUpdate = frameCount % 2 === 0;

        // Adjust gravity based on scale - smaller/distant fireworks have less gravity 
        const storedScale = (fw.mesh as any).fireworkScale || 1.0;
        const gravity = 0.01 * storedScale;

        for (let j = 0; j < particleCount; j++) {
          const idx = j * 3;

          pos[idx] += fw.velocities[idx];
          pos[idx + 1] += fw.velocities[idx + 1];
          pos[idx + 2] += fw.velocities[idx + 2];
          fw.velocities[idx + 1] -= gravity;

          // Only update trails for larger fireworks and every other frame
          if (needsUpdate && fw.trailMeshes[j]) {
            const trailMesh = fw.trailMeshes[j];
            const history = (trailMesh as any).particleHistory as THREE.Vector3[];
            
            history.push(new THREE.Vector3(pos[idx], pos[idx + 1], pos[idx + 2]));
            
            const maxHistory = Math.max(4, Math.floor(8 * storedScale));
            if (history.length > maxHistory) {
              history.shift();
            }

            if (history.length >= 2) {
              const curve = new THREE.CatmullRomCurve3(history);
              trailMesh.geometry.dispose();
              trailMesh.geometry = new THREE.TubeGeometry(curve, Math.min(history.length, 6), 0.04, 3, false); // Reduced segments
            }
          }
        }

        fw.mesh.geometry.attributes.position.needsUpdate = true;
        fw.life--;

        const material = fw.mesh.material as THREE.PointsMaterial;
        material.opacity = fw.life / 100;

        if (fw.trailMeshes.length > 0) {
          const trailMat = fw.trailMeshes[0].material as THREE.MeshBasicMaterial;
          trailMat.opacity = (fw.life / 100) * 0.5;
        }

        if (fw.life <= 0) {
          scene.remove(fw.mesh);
          fw.mesh.geometry.dispose();
          material.dispose();

          const sharedMaterial = fw.trailMeshes[0]?.material;
          fw.trailMeshes.forEach(tm => {
            scene.remove(tm);
            tm.geometry.dispose();
          });
          if (sharedMaterial) {
            (sharedMaterial as THREE.Material).dispose();
          }
          
          fireworks.current.splice(i, 1);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
      stopAllSounds();
      clearAllFireworks();
      renderer.dispose();
      starMaterial.dispose();
      starGeometry.dispose();
      rocketGeometry.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [userLocation]);

  return <div ref={containerRef} className="fixed inset-0 pointer-events-auto" />;
}