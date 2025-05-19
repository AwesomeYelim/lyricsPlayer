import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const ThreeVisualizer: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  let renderer: THREE.WebGLRenderer | null = null;

  useEffect(() => {
    if (!mountRef.current) return;
    console.log("Initializing Three.js...");

    // Three.js 기본 설정
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    if (renderer) {
      renderer.dispose(); // 이전 renderer 해제
      mountRef.current.removeChild(renderer.domElement);
    }

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const light = new THREE.PointLight(0xffffff, 2, 100);
    light.position.set(5, 5, 5);
    scene.add(light);

    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        console.log("🔊 오디오 분석기 설정 완료!");
      } catch (error) {
        console.error("오디오 입력을 가져오는 데 실패했습니다:", error);
      }
    };

    setupAudio();

    const animate = () => {
      requestAnimationFrame(animate);
      if (renderer) renderer.render(scene, camera);

      if (analyserRef.current && dataArrayRef.current && meshRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);

        const volume =
          dataArrayRef.current.reduce((a, b) => a + b, 0) /
          dataArrayRef.current.length;
        const scale = 1 + volume / 50;
        meshRef.current.scale.set(scale, scale, scale);

        // 색상 변경
        const bass =
          dataArrayRef.current.slice(0, 32).reduce((a, b) => a + b, 0) / 32;
        const treble =
          dataArrayRef.current.slice(100, 256).reduce((a, b) => a + b, 0) / 156;

        const color = new THREE.Color(
          Math.min(bass / 256, 1),
          Math.min(1 - bass / 256, 1),
          Math.min(treble / 256, 1)
        );
        (meshRef.current.material as THREE.MeshStandardMaterial).color.set(
          color
        );

        const time = performance.now() * 0.002;
        meshRef.current.rotation.x = time;
        meshRef.current.rotation.y = time;
      }
    };

    animate();

    const onResize = () => {
      if (renderer && camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      console.log("Cleaning up...");
      window.removeEventListener("resize", onResize);
      if (renderer) {
        renderer.dispose();
      }
      scene.clear();
      if (mountRef.current && renderer) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
};

export default ThreeVisualizer;
