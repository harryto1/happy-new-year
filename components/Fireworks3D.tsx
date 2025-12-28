"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import Pusher from "pusher-js";

type Firework = {
  mesh: THREE.Points;
  velocities: Float32Array;
  life: number;
  trailMeshes: THREE.Mesh[]; // Individual trail meshes for each particle
};

type Rocket = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  targetY: number;
  trail: THREE.Mesh; // Tube-based trail
  trailPositions: THREE.Vector3[];
};

export default function FireworksOnlyCursor() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fireworks = useRef<Firework[]>([]);
  const rockets = useRef<Rocket[]>([]);
  const clientId = useRef<string>(Math.random().toString(36).substring(7));

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Pusher
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    // Use environment-aware channel name
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
      antialias: false, // Disable for performance
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    containerRef.current.appendChild(renderer.domElement);

    // === AUDIO SETUP ===
    const audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    // Audio Loader
    const audioLoader = new THREE.AudioLoader();

    // Load sounds
    const launchSound = new THREE.Audio(audioListener);
    const explosionSound = new THREE.Audio(audioListener);

    audioLoader.load('/sounds/rocket-launch.mp3', (buffer) => {
      launchSound.setBuffer(buffer);
      launchSound.setVolume(0.5);
    });

    audioLoader.load('/sounds/explosion.mp3', (buffer) => {
      explosionSound.setBuffer(buffer);
      explosionSound.setVolume(0.7);
    });

    // Helper functino to play sound (allows multiple instances)
    const playSound = (sound: THREE.Audio) => {
        if (sound.isPlaying) {
            // Clone the sound to play multiple instances
            const clone = sound.clone();
            clone.play();
        } else {
            sound.play();
        }
    };

    // Helper function to stop sound
    const stopSound = (sound: THREE.Audio) => {
        if (sound.isPlaying) {
            sound.stop();
        }
    }

    // === STARS ===
    const starCount = 800;
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

    // Reusable geometries pool
    const tubeGeometryCache = new Map<string, THREE.TubeGeometry>();
    
    const getTubeGeometry = (pointCount: number, radius: number, segments: number) => {
      const key = `${pointCount}-${radius}-${segments}`;
      if (!tubeGeometryCache.has(key)) {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < pointCount; i++) {
          points.push(new THREE.Vector3(0, i * 0.1, 0));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        tubeGeometryCache.set(key, new THREE.TubeGeometry(curve, segments, radius, 3, false));
      }
      return tubeGeometryCache.get(key)!.clone();
    };

    // Launch rocket with tube trail
    const launchRocket = (targetX: number, targetY: number, color?: THREE.Color) => {
      const rocketColor = color || new THREE.Color().setHSL(Math.random(), 1, 0.6);

      playSound(launchSound);

      const geometry = new THREE.SphereGeometry(0.2, 8, 8);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00,
      });
      
      const rocket = new THREE.Mesh(geometry, material);
      const bottomY = -30;
      rocket.position.set(targetX, bottomY, 0);
      
      const speed = 1.2;
      const driftX = (Math.random() - 0.5) * 0.15;
      const driftZ = (Math.random() - 0.5) * 0.1;
      const velocity = new THREE.Vector3(driftX, speed, driftZ);

      // Create initial trail curve
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(targetX, bottomY, 0),
        new THREE.Vector3(targetX, bottomY, 0),
      ]);

      const tubeGeometry = new THREE.TubeGeometry(curve, 6, 0.08, 4, false); // Reduced segments
      const tubeMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.6,
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
      return rocketColor; 
    };

    // Explosion function with individual particle trails
    const explode = (x: number, y: number, color?: THREE.Color) => {
      stopSound(launchSound);
      playSound(explosionSound);
      
      const count = 60; // Reduced from 80
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = 0;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = Math.random() * 0.6 + 0.3;

        velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
        velocities[i * 3 + 2] = Math.cos(phi) * speed * 0.3;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const particleColor = color || new THREE.Color().setHSL(Math.random(), 1, 0.6);

      const material = new THREE.PointsMaterial({
        size: 0.35, // Slightly larger to compensate for fewer particles
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: particleColor,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      // Create trail mesh for each particle with optimizations
      const trailMeshes: THREE.Mesh[] = [];
      
      // Shared material for all trails of this firework
      const sharedTrailMaterial = new THREE.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      for (let i = 0; i < count; i++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, y, 0),
          new THREE.Vector3(x, y, 0),
        ]);

        const tubeGeometry = new THREE.TubeGeometry(curve, 4, 0.04, 3, false); // Minimal segments

        const trailMesh = new THREE.Mesh(tubeGeometry, sharedTrailMaterial);
        trailMesh.frustumCulled = true; // Enable frustum culling
        scene.add(trailMesh);
        trailMeshes.push(trailMesh);

        // Store particle history on mesh
        (trailMesh as any).particleHistory = [new THREE.Vector3(x, y, 0)];
      }

      fireworks.current.push({ 
        mesh: points, 
        velocities, 
        life: 100,
        trailMeshes,
      });
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
            body: JSON.stringify({ x: normalizedX, y: normalizedY, clientId: clientId.current, color: color.getHex() }),
        });
      } catch (error) {
        console.log('Failed to trigger firework: ', error);
      }
    };

    channel.bind('new-firework', (data: { x:number; y:number; clientId: string; color: number }) => {
        if (data.clientId === clientId.current) return;
        const worldX = data.x * 300 - 150;
        const worldY = data.y * 150 - 75;
        const color = new THREE.Color(data.color); 
        launchRocket(worldX, worldY, color);
    });

    window.addEventListener("click", handleClick);

    let frameCount = 0;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      const time = Date.now() * 0.001;
      frameCount++;

      starMaterial.uniforms.time.value = time;

      // Update rockets with tube trails
      rockets.current.forEach((rocket, i) => {
        rocket.velocity.y -= 0.0005;
        rocket.velocity.x += (Math.random() - 0.5) * 0.2;
        rocket.velocity.z += (Math.random() - 0.5) * 0.1;
        rocket.mesh.position.add(rocket.velocity);

        // Update trail positions
        rocket.trailPositions.push(rocket.mesh.position.clone());
        const maxTrailLength = 5;
        if (rocket.trailPositions.length > maxTrailLength) {
          rocket.trailPositions.shift();
        }

        // Recreate tube geometry with updated curve (less frequently)
        if (rocket.trailPositions.length >= 2 && frameCount % 2 === 0) { // Update every other frame
          const curve = new THREE.CatmullRomCurve3(rocket.trailPositions);
          rocket.trail.geometry.dispose();
          rocket.trail.geometry = new THREE.TubeGeometry(curve, Math.min(rocket.trailPositions.length, 6), 0.08, 4, false);
        }

        if (rocket.mesh.position.y >= rocket.targetY || rocket.velocity.y < 0) {
          const storedColor = (rocket.mesh as any).fireworkColor; 
          explode(rocket.mesh.position.x, rocket.mesh.position.y, storedColor);
          
          scene.remove(rocket.mesh);
          scene.remove(rocket.trail);
          rocket.mesh.geometry.dispose();
          (rocket.mesh.material as THREE.Material).dispose();
          rocket.trail.geometry.dispose();
          (rocket.trail.material as THREE.Material).dispose();
          rockets.current.splice(i, 1);
        }
      });

      // Update fireworks with particle trails (optimized batching)
      fireworks.current.forEach((fw, i) => {
        const pos = fw.mesh.geometry.attributes.position.array as Float32Array;
        const particleCount = pos.length / 3;

        // Batch geometry updates
        const needsUpdate = frameCount % 2 === 0; // Update trails every other frame

        for (let j = 0; j < particleCount; j++) {
          const idx = j * 3;

          // Update particle position
          pos[idx] += fw.velocities[idx];
          pos[idx + 1] += fw.velocities[idx + 1];
          pos[idx + 2] += fw.velocities[idx + 2];
          fw.velocities[idx + 1] -= 0.01;

          // Update trail for this particle (less frequently)
          if (needsUpdate && fw.trailMeshes[j]) {
            const trailMesh = fw.trailMeshes[j];
            const history = (trailMesh as any).particleHistory as THREE.Vector3[];
            
            // Add current position to history
            history.push(new THREE.Vector3(pos[idx], pos[idx + 1], pos[idx + 2]));
            
            const maxHistory = 10; // Reduced from 15
            if (history.length > maxHistory) {
              history.shift();
            }

            // Update tube geometry with minimal segments
            if (history.length >= 2) {
              const curve = new THREE.CatmullRomCurve3(history);
              trailMesh.geometry.dispose();
              trailMesh.geometry = new THREE.TubeGeometry(curve, Math.min(history.length, 8), 0.04, 3, false);
            }
          }
        }

        fw.mesh.geometry.attributes.position.needsUpdate = true;
        fw.life--;

        const material = fw.mesh.material as THREE.PointsMaterial;
        material.opacity = fw.life / 100;

        // Update trail opacity (shared material)
        if (fw.trailMeshes.length > 0) {
          const trailMat = fw.trailMeshes[0].material as THREE.MeshBasicMaterial;
          trailMat.opacity = (fw.life / 100) * 0.5;
        }

        if (fw.life <= 0) {
          scene.remove(fw.mesh);
          fw.mesh.geometry.dispose();
          material.dispose();

          // Clean up trail meshes
          const sharedMaterial = fw.trailMeshes[0]?.material;
          fw.trailMeshes.forEach(tm => {
            scene.remove(tm);
            tm.geometry.dispose();
          });
          // Dispose shared material once
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
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
      renderer.dispose();
      starMaterial.dispose();
      starGeometry.dispose();
      tubeGeometryCache.forEach(geom => geom.dispose());
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 pointer-events-auto" />;
}