import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';

const LIME = '#C8FF2E';
const DARK = '#10110E';

function drawDocument(canvas, progress) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#F8FAF0';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#171A12';
  context.font = 'bold 42px Georgia';
  context.fillText('INVOICE', 48, 86);
  context.fillStyle = '#69705F';
  context.font = '20px Georgia';
  context.fillText('APEX DIGITAL STUDIO', 48, 130);
  context.fillStyle = LIME;
  context.fillRect(48, 160, 604, 62);
  context.fillStyle = '#11140B';
  context.font = 'bold 21px Georgia';
  context.fillText('DESCRIPTION', 68, 199);
  context.fillText('QTY', 430, 199);
  context.fillText('TOTAL', 535, 199);
  const rows = ['Brand identity & logo suite', 'Creative direction', 'Vector exports & social kit'];
  rows.slice(0, Math.ceil(progress * rows.length)).forEach((row, index) => {
    const y = 282 + index * 75;
    context.fillStyle = '#272B21';
    context.font = '24px Georgia';
    context.fillText(row, 54, y);
    context.fillStyle = '#747A69';
    context.font = '21px Georgia';
    context.fillText(index === 0 ? '5' : '1', 440, y);
    context.fillText(index === 0 ? '₹11,800' : 'Included', 530, y);
    context.strokeStyle = '#E2E6D7';
    context.beginPath();
    context.moveTo(48, y + 28);
    context.lineTo(652, y + 28);
    context.stroke();
  });
  if (progress >= 0.8) {
    context.fillStyle = '#161A10';
    context.font = 'bold 32px Georgia';
    context.fillText('TOTAL DUE', 370, 570);
    context.fillStyle = '#536B00';
    context.font = 'bold 38px Georgia';
    context.fillText('₹11,800.00', 430, 630);
  }
  context.fillStyle = '#737A68';
  context.font = '20px Georgia';
  context.fillText('Thank you for your business.', 48, 840);
}

function makeDocumentTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 700;
  canvas.height = 920;
  drawDocument(canvas, 0);
  return new THREE.CanvasTexture(canvas);
}

function drawPrompt(canvas, progress) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#141610';
  context.fillRect(0, 0, 620, 260);
  context.strokeStyle = 'rgba(200,255,46,.7)';
  context.lineWidth = 3;
  context.strokeRect(2, 2, 616, 256);
  context.fillStyle = LIME;
  context.font = 'bold 24px Georgia';
  context.fillText('✦  LIVE INVOICE PREVIEW', 30, 58);
  context.fillStyle = '#F4F6EE';
  context.font = '22px Georgia';
  const lineOne = 'CLIENT: RAHUL • 5 LOGO DESIGNS';
  const lineTwo = '₹2,000 EACH • 18% GST';
  const characters = Math.floor(progress * (lineOne.length + lineTwo.length));
  context.fillText(lineOne.slice(0, characters), 30, 110);
  context.fillText(lineTwo.slice(0, Math.max(0, characters - lineOne.length)), 30, 145);
  context.fillStyle = '#A3AA96';
  context.font = '18px Georgia';
  context.fillText('Drafted in seconds', 30, 210);
}

function makePromptTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 260;
  drawPrompt(canvas, 0);
  return new THREE.CanvasTexture(canvas);
}

function makePaidTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 140;
  const context = canvas.getContext('2d');
  context.fillStyle = '#10110E';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = LIME;
  context.font = 'bold 68px Georgia';
  context.textAlign = 'center';
  context.fillText('✓  PAID', canvas.width / 2, 94);
  return new THREE.CanvasTexture(canvas);
}

function makeQRTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 240;
  const context = canvas.getContext('2d');
  context.fillStyle = '#F7F9EF';
  context.fillRect(0, 0, 240, 240);
  const size = 12;
  let seed = 41;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      if (random() > 0.48) {
        context.fillStyle = '#10110E';
        context.fillRect(x * size, y * size, size - 1, size - 1);
      }
    }
  }
  [[0, 0], [14, 0], [0, 14]].forEach(([x, y]) => {
    context.fillStyle = LIME;
    context.fillRect(x * size, y * size, 6 * size, 6 * size);
    context.fillStyle = '#10110E';
    context.fillRect((x + 1) * size, (y + 1) * size, 4 * size, 4 * size);
    context.fillStyle = '#F7F9EF';
    context.fillRect((x + 2) * size, (y + 2) * size, 2 * size, 2 * size);
  });
  return new THREE.CanvasTexture(canvas);
}

function Label({ texture, size, position, z = 0.1 }) {
  return (
    <mesh position={[position[0], position[1], position[2] + z]}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function InvoiceScene({ sceneRef, active }) {
  const sheetTexture = useMemo(makeDocumentTexture, []);
  const promptTexture = useMemo(makePromptTexture, []);
  const paidTexture = useMemo(makePaidTexture, []);
  const qrTexture = useMemo(makeQRTexture, []);
  const paidRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    const progress = { prompt: 0, fill: 0 };
    const updateTextures = () => {
      drawPrompt(promptTexture.image, progress.prompt);
      drawDocument(sheetTexture.image, progress.fill);
      promptTexture.needsUpdate = true;
      sheetTexture.needsUpdate = true;
    };
    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.1 });
    timeline
      .to(progress, { prompt: 1, duration: 2.4, ease: 'none', onUpdate: updateTextures })
      .to(progress, { fill: 1, duration: 0.9, ease: 'power1.out', onUpdate: updateTextures })
      .fromTo(paidRef.current.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(1.7)' })
      .fromTo(qrRef.current.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(1.7)' }, '<0.12');
    const pauseForHiddenTab = () => {
      if (document.hidden) timeline.pause();
      else timeline.resume();
    };
    document.addEventListener('visibilitychange', pauseForHiddenTab);
    return () => {
      document.removeEventListener('visibilitychange', pauseForHiddenTab);
      timeline.kill();
      sheetTexture.dispose();
      promptTexture.dispose();
      paidTexture.dispose();
      qrTexture.dispose();
    };
  }, [paidTexture, promptTexture, qrTexture, sheetTexture]);

  useFrame(({ clock, pointer }, delta) => {
    if (!active || !sceneRef.current) return;
    const group = sceneRef.current;
    const elapsed = clock.getElapsedTime();
    const scrollProgress = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, pointer.x * 0.12 + Math.sin(elapsed * 0.24) * 0.025, 5, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, -pointer.y * 0.07 - scrollProgress * 0.035, 5, delta);
    group.position.y = THREE.MathUtils.damp(group.position.y, Math.sin(elapsed * 0.65) * 0.09 - scrollProgress * 0.15, 4, delta);
  });

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 6]} intensity={2.2} color="#F4F6EE" />
      <pointLight position={[-2, -1.6, 1.8]} intensity={28} distance={7} color={LIME} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.02, -0.5]}>
        <planeGeometry args={[15, 11]} />
        <meshStandardMaterial color="#11130D" emissive="#536B00" emissiveIntensity={0.28} roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.005, -0.3]}>
        <circleGeometry args={[2.8, 64]} />
        <meshBasicMaterial color={LIME} transparent opacity={0.13} />
      </mesh>
      <group ref={sceneRef} position={[0, 0.05, 0]}>
        {[0, 1, 2].map((layer) => (
          <mesh key={layer} position={[-0.06 + layer * 0.03, -0.06 - layer * 0.055, -0.18 - layer * 0.13]} castShadow>
            <boxGeometry args={[2.9, 3.65, 0.13]} />
            <meshStandardMaterial color={layer === 0 ? '#C8FF2E' : '#E5E9D9'} roughness={0.48} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[2.9, 3.65, 0.15]} />
          <meshStandardMaterial color="#F7F9EF" roughness={0.55} />
        </mesh>
        <Label texture={sheetTexture} size={[2.68, 3.45]} position={[0, 0, 0.08]} />

        <group position={[2.12, 1.15, 0.42]}>
          <mesh castShadow>
            <boxGeometry args={[1.92, 0.88, 0.16]} />
            <meshStandardMaterial color={DARK} emissive="#4D6400" emissiveIntensity={0.55} roughness={0.32} />
          </mesh>
          <Label texture={promptTexture} size={[1.86, 0.78]} position={[0, 0, 0.09]} />
        </group>

        <group ref={paidRef} position={[-1.95, 1.12, 0.45]} scale={[0.01, 0.01, 0.01]}>
          <mesh castShadow>
            <boxGeometry args={[0.98, 0.43, 0.14]} />
            <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={0.15} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <planeGeometry args={[0.9, 0.36]} />
            <meshBasicMaterial color={DARK} />
          </mesh>
          <Label texture={paidTexture} size={[0.86, 0.34]} position={[0, 0, 0.1]} />
        </group>

        <group ref={qrRef} position={[1.95, -1.12, 0.45]} scale={[0.01, 0.01, 0.01]}>
          <mesh castShadow>
            <boxGeometry args={[0.94, 0.94, 0.16]} />
            <meshStandardMaterial color={LIME} emissive={LIME} emissiveIntensity={0.2} roughness={0.28} />
          </mesh>
          <Label texture={qrTexture} size={[0.78, 0.78]} position={[0, 0, 0.09]} />
        </group>
      </group>
    </>
  );
}

function SceneRoot({ container }) {
  const sceneRef = useRef(null);
  const [active, setActive] = useState(!document.hidden);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setActive(!document.hidden && container.getBoundingClientRect().bottom > 0 && container.getBoundingClientRect().top < window.innerHeight);
    const observer = new IntersectionObserver(([entry]) => setActive(!document.hidden && entry.isIntersecting), { threshold: 0.01 });
    observer.observe(container);
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('scroll', updateVisibility);
    };
  }, [container]);

  useEffect(() => {
    const hero = container.closest('section');
    if (ready) {
      container.dataset.ready = 'true';
      hero?.classList.add('hero-has-3d-scene');
    }
    return () => {
      delete container.dataset.ready;
      hero?.classList.remove('hero-has-3d-scene');
    };
  }, [container, ready]);

  return (
    <Canvas
      aria-hidden="true"
      dpr={[1, 1.5]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0.15, 9.5], fov: 36 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0A0A0A', 0);
        gl.domElement.addEventListener('webglcontextlost', () => {
          setReady(false);
          container.dispatchEvent(new CustomEvent('invox-scene-fallback'));
        });
        setReady(true);
      }}
    >
      <InvoiceScene sceneRef={sceneRef} active={active} />
    </Canvas>
  );
}

export function mountInvoiceScene(container) {
  const root = createRoot(container);
  root.render(<SceneRoot container={container} />);
  return () => root.unmount();
}
