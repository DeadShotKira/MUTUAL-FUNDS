import React, { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { MutualFund } from '../types/portfolio';
import { formatINR, formatPercent, getAlertBadgeStyle } from '../utils/formatters';
import { Orbit, Sparkles, Eye, RotateCcw, Play, Pause, Layers } from 'lucide-react';

interface Props {
  funds: MutualFund[];
  onSelectFund: (schemeCode: string) => void;
  selectedSchemeCode?: string | null;
}

// Single Orbit Ring line
const OrbitRing: React.FC<{ radius: number; color?: string }> = ({ radius, color = '#1e293b' }) => {
  const points = useMemo(() => {
    const pts = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
    }
    return pts;
  }, [radius]);

  const lineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
    return new THREE.Line(geo, mat);
  }, [points, color]);

  return <primitive object={lineObj} />;
};

// Central Sun / Portfolio Core
const PortfolioSun: React.FC<{ isProfit: boolean }> = ({ isProfit }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4;
    }
    if (glowRef.current) {
      glowRef.current.rotation.y -= delta * 0.2;
    }
  });

  const sunColor = isProfit ? '#06b6d4' : '#f59e0b';

  return (
    <group>
      {/* Core Sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshStandardMaterial
          color={sunColor}
          emissive={sunColor}
          emissiveIntensity={1.2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Atmospheric Glow Shell */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.7, 24, 24]} />
        <meshBasicMaterial
          color={sunColor}
          transparent
          opacity={0.2}
          wireframe
        />
      </mesh>

      {/* Point Lights */}
      <pointLight color={sunColor} intensity={3.5} distance={25} />
      <pointLight color="#ffffff" intensity={1.5} distance={10} />
    </group>
  );
};

// Orbiting Fund Node
interface FundNodeProps {
  fund: MutualFund;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: (schemeCode: string) => void;
  hoveredCode: string | null;
  setHoveredCode: (code: string | null) => void;
  autoRotate: boolean;
}

const FundNode: React.FC<FundNodeProps> = ({
  fund,
  index,
  total,
  isSelected,
  onSelect,
  hoveredCode,
  setHoveredCode,
  autoRotate
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // Distribute orbital radii from 3.2 to 9.5
  const orbitRadius = 3.2 + index * 0.7;
  const orbitSpeed = (0.2 / Math.sqrt(orbitRadius)) * (index % 2 === 0 ? 1 : 0.85);
  const initialAngle = (index / total) * Math.PI * 2;
  const angleRef = useRef(initialAngle);

  // Size corresponds to valuation proportion
  const nodeSize = 0.35 + Math.min(0.3, (fund.currentValue / 300000) * 0.25);

  useFrame((_, delta) => {
    if (autoRotate) {
      angleRef.current += delta * orbitSpeed;
    }
    if (groupRef.current) {
      const x = Math.cos(angleRef.current) * orbitRadius;
      const z = Math.sin(angleRef.current) * orbitRadius;
      const y = Math.sin(angleRef.current * 2) * 0.3; // subtle wave
      groupRef.current.position.set(x, y, z);
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.5;
    }
  });

  const isHovered = hoveredCode === fund.schemeCode;
  const isBuy = fund.alert?.tag?.includes('BUY');
  const nodeColor = isBuy ? '#f43f5e' : fund.color || '#3b82f6';

  return (
    <>
      <OrbitRing radius={orbitRadius} color={isBuy ? '#f43f5e' : '#334155'} />

      <group ref={groupRef}>
        <mesh
          ref={meshRef}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(fund.schemeCode);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredCode(fund.schemeCode);
          }}
          onPointerOut={() => setHoveredCode(null)}
          scale={isHovered || isSelected ? 1.4 : 1.0}
        >
          <sphereGeometry args={[nodeSize, 24, 24]} />
          <meshStandardMaterial
            color={nodeColor}
            emissive={nodeColor}
            emissiveIntensity={isHovered || isSelected ? 1.0 : isBuy ? 0.8 : 0.4}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>

        {/* Pulsing ring for BUY alerts or Selected fund */}
        {(isBuy || isSelected) && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[nodeSize * 1.3, nodeSize * 1.5, 32]} />
            <meshBasicMaterial
              color={isBuy ? '#f43f5e' : '#06b6d4'}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* HTML 3D Floating Tooltip on Hover */}
        {isHovered && (
          <Html distanceFactor={14} position={[0, nodeSize + 0.5, 0]} center>
            <div className="pointer-events-none rounded-xl bg-slate-900/95 border border-cyan-500/50 p-3 shadow-2xl backdrop-blur-md w-48 text-left animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold border border-cyan-800">
                  {fund.category}
                </span>
                <span className="text-[10px] font-mono text-slate-400">{fund.schemeCode}</span>
              </div>
              <h5 className="mt-1 text-xs font-bold text-white leading-tight truncate">
                {fund.shortName || fund.name}
              </h5>
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-400">NAV: ₹{fund.latestNAV.toFixed(2)}</span>
                <span className={fund.returnPct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {formatPercent(fund.returnPct)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Value: {formatINR(fund.currentValue, true)}</span>
                <span className="text-rose-400 font-bold">{fund.alert?.tag}</span>
              </div>
              <p className="mt-1.5 text-[9px] text-cyan-400 text-center font-mono">
                Click to inspect details
              </p>
            </div>
          </Html>
        )}
      </group>
    </>
  );
};

// 2D Fallback Radar View
const FallbackRadar2D: React.FC<{
  funds: MutualFund[];
  onSelect: (schemeCode: string) => void;
  selectedSchemeCode?: string | null;
}> = ({ funds, onSelect, selectedSchemeCode }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-full border border-slate-800 bg-slate-950/60 flex items-center justify-center">
        {/* Radar Rings */}
        <div className="absolute inset-8 rounded-full border border-slate-800/80"></div>
        <div className="absolute inset-20 rounded-full border border-slate-800/60"></div>
        <div className="absolute inset-32 rounded-full border border-cyan-500/20"></div>

        {/* Center Portfolio Sun */}
        <div className="w-12 h-12 rounded-full bg-cyan-500 shadow-glow-cyan flex items-center justify-center font-bold font-mono text-slate-950 text-xs z-10 animate-pulse">
          AURA
        </div>

        {/* 10 Orbiting Funds positioned along circle */}
        {funds.map((f, i) => {
          const total = funds.length;
          const angle = (i / total) * Math.PI * 2;
          const radiusPct = 25 + (i % 3) * 18; // Distribute across rings
          const x = 50 + Math.cos(angle) * radiusPct;
          const y = 50 + Math.sin(angle) * radiusPct;
          const isSelected = selectedSchemeCode === f.schemeCode;
          const isBuy = f.alert?.tag?.includes('BUY');

          return (
            <button
              key={f.schemeCode}
              onClick={() => onSelect(f.schemeCode)}
              title={`${f.name} - ₹${f.latestNAV} (${formatPercent(f.returnPct)})`}
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
              className={`absolute group p-1.5 rounded-full transition-transform hover:scale-125 z-20 ${
                isSelected ? 'ring-2 ring-cyan-400 scale-110' : ''
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white font-mono shadow-md ${
                  isBuy ? 'ring-2 ring-rose-500 animate-bounce' : ''
                }`}
                style={{ backgroundColor: f.color || '#3b82f6' }}
              >
                {i + 1}
              </div>
              <span className="hidden group-hover:block absolute left-8 top-0 whitespace-nowrap px-2 py-1 bg-slate-900 border border-slate-700 text-xs text-white rounded font-mono shadow-xl z-30">
                {f.shortName || f.name} (₹{f.latestNAV})
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs font-mono text-slate-400">
        2D Radar Projection • Click any fund node to inspect full historical NAV chart
      </p>
    </div>
  );
};

export const InvestmentUniverse3D: React.FC<Props> = ({
  funds,
  onSelectFund,
  selectedSchemeCode
}) => {
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const controlsRef = useRef<any>(null);

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const isOverallProfit = funds.reduce((acc, f) => acc + f.profitLoss, 0) >= 0;

  return (
    <div className="relative w-full h-[460px] lg:h-[520px] rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-fintech-dark border border-slate-800 overflow-hidden shadow-card-elevated">
      {/* Overlay Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex items-center gap-2 text-xs font-mono text-cyan-400 shadow-sm">
            <Orbit className="w-4 h-4 animate-spin-slow text-cyan-400" />
            <span className="font-bold tracking-wider">3D INVESTMENT UNIVERSE</span>
          </div>
        </div>

        {/* View & Animation Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 backdrop-blur-md p-1 rounded-xl pointer-events-auto shadow-sm">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? 'Pause Orbit' : 'Resume Orbit'}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={resetCamera}
            title="Reset Camera"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-800"></div>
          <button
            onClick={() => setViewMode(viewMode === '3D' ? '2D' : '3D')}
            title="Toggle 2D / 3D Mode"
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{viewMode}</span>
          </button>
        </div>
      </div>

      {/* Main Visualizer Area */}
      {viewMode === '3D' ? (
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center font-mono text-xs text-slate-400">
            Initializing 3D Universe...
          </div>
        }>
          <Canvas
            camera={{ position: [0, 8, 14], fov: 45 }}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          >
            <ambientLight intensity={0.4} />
            <Stars radius={50} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

            {/* Central Portfolio Core */}
            <PortfolioSun isProfit={isOverallProfit} />

            {/* Orbiting Fund Nodes */}
            {funds.map((fund, idx) => (
              <FundNode
                key={fund.schemeCode}
                fund={fund}
                index={idx}
                total={funds.length}
                isSelected={selectedSchemeCode === fund.schemeCode}
                onSelect={onSelectFund}
                hoveredCode={hoveredCode}
                setHoveredCode={setHoveredCode}
                autoRotate={autoRotate}
              />
            ))}

            <OrbitControls
              ref={controlsRef}
              enablePan={true}
              enableZoom={true}
              minDistance={5}
              maxDistance={28}
              maxPolarAngle={Math.PI / 2 + 0.1}
            />
          </Canvas>
        </Suspense>
      ) : (
        <FallbackRadar2D
          funds={funds}
          onSelect={onSelectFund}
          selectedSchemeCode={selectedSchemeCode}
        />
      )}

      {/* Bottom Hint */}
      <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between text-[11px] font-mono text-slate-500 pointer-events-none">
        <span>Drag to rotate • Scroll to zoom • Click a fund sphere to view historical analytics</span>
        <span className="hidden sm:inline">WebGL Accelerated</span>
      </div>
    </div>
  );
};
