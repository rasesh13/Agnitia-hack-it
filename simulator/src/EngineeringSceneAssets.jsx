import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VIT_SITES = {
  north: [-15, 0.25, -225],
  south: [-35, 0.25, 185],
  east: [265, 0.25, -30],
  west: [-275, 0.25, 16],
  energy: [-170, 0.25, 128],
};

const REGIONAL_SITES = {
  north: [5, 0.25, -182],
  south: [-12, 0.25, 178],
  east: [188, 0.25, 24],
  west: [-188, 0.25, 16],
  energy: [-156, 0.25, 126],
};

function ProposedBuilding({ proposal, position, index }) {
  const group = useRef();
  const width = THREE.MathUtils.clamp(Math.sqrt(proposal.footprint) * 0.42, 13, 38);
  const depth = THREE.MathUtils.clamp(proposal.footprint / Math.max(width * 42, 1), 10, 30);
  const height = THREE.MathUtils.clamp(proposal.floors * 3.35, 4.5, 48);
  const panelColumns = Math.max(2, Math.min(7, Math.round(width / 4.5)));

  useFrame(({ clock }) => {
    if (!group.current) return;
    const target = 1 + Math.sin(clock.elapsedTime * 1.4 + index) * 0.008;
    group.current.scale.lerp(new THREE.Vector3(target, target, target), 0.05);
  });

  return (
    <group ref={group} position={position} rotation={[0, index % 2 ? 0.08 : -0.05, 0]}>
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <boxGeometry args={[width + 5, 0.3, depth + 5]} />
        <meshStandardMaterial color="#8bb8ae" transparent opacity={0.42} />
      </mesh>
      <mesh position={[0, height / 2 + 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={proposal.template.color}
          roughness={0.6}
          metalness={0.08}
          transparent
          opacity={0.93}
        />
      </mesh>
      {Array.from({ length: Math.min(8, proposal.floors * 2) }, (_, floorIndex) => {
        const row = Math.floor(floorIndex / 2);
        const side = floorIndex % 2 ? 1 : -1;
        return (
          <mesh
            key={`window-row-${floorIndex}`}
            position={[side * (width / 2 + 0.012), 2.2 + row * 3.25, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <boxGeometry args={[Math.max(3, depth * 0.68), 1.15, 0.04]} />
            <meshStandardMaterial color="#bce6ef" emissive="#4c8d9e" emissiveIntensity={0.28} />
          </mesh>
        );
      })}
      <mesh position={[0, height + 0.56, 0]} castShadow>
        <boxGeometry args={[width + 0.8, 0.72, depth + 0.8]} />
        <meshStandardMaterial color="#475b61" roughness={0.82} />
      </mesh>
      {Array.from({ length: panelColumns }, (_, panelIndex) => (
        <mesh
          key={`proposal-panel-${panelIndex}`}
          position={[
            (panelIndex - (panelColumns - 1) / 2) * Math.min(4.2, width / panelColumns),
            height + 1.05,
            0,
          ]}
          rotation={[-0.13, 0, 0]}
        >
          <boxGeometry args={[Math.min(3.5, width / panelColumns - 0.3), 0.12, Math.max(3.2, depth * 0.58)]} />
          <meshStandardMaterial color="#174d69" metalness={0.55} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 0.58, depth / 2 + 0.05]}>
        <boxGeometry args={[Math.min(5.5, width * 0.28), 1.2, 0.25]} />
        <meshStandardMaterial color="#f0bf6e" emissive="#8e5b22" emissiveIntensity={0.18} />
      </mesh>
      <Html position={[0, height + 4.5, 0]} center distanceFactor={120}>
        <div className="proposed-building-label">
          <span>PROPOSED</span>
          <b>{proposal.name}</b>
          <small>{proposal.peakDemandMw.toFixed(2)} MW • {proposal.recommendedPanels.toLocaleString("en-IN")} panels</small>
        </div>
      </Html>
    </group>
  );
}

export function ProposedCampusAssets({ proposals = [], variant = "regional", sites: siteOverrides }) {
  const sites = siteOverrides || (variant === "vit" ? VIT_SITES : REGIONAL_SITES);
  return (
    <group>
      {proposals.map((proposal, index) => {
        const base = sites[proposal.site] || sites.north;
        const row = Math.floor(index / 3);
        const offset = (index % 3) - 1;
        const position = [
          base[0] + offset * 34,
          base[1],
          base[2] + row * 32,
        ];
        return (
          <ProposedBuilding
            key={proposal.id}
            proposal={proposal}
            position={position}
            index={index}
          />
        );
      })}
    </group>
  );
}

function FaultPulse({ phase }) {
  const pulse = useRef();
  const flash = useRef();
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (pulse.current) {
      const scale = 0.8 + ((time * 2.4) % 1) * 2.4;
      pulse.current.scale.setScalar(scale);
      pulse.current.material.opacity = Math.max(0, 0.68 - (scale - 0.8) * 0.23);
    }
    if (flash.current) {
      const active = phase === "fault";
      flash.current.intensity = active ? 18 + Math.sin(time * 28) * 12 : 3.5;
    }
  });
  return (
    <>
      <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.35, 0]}>
        <ringGeometry args={[3.1, 3.65, 28]} />
        <meshBasicMaterial color="#ff5f45" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <pointLight
        ref={flash}
        color="#ff6a32"
        intensity={8}
        distance={52}
        decay={2}
        position={[0, 7, 0]}
        userData={{ preserveDuringBlackout: true }}
      />
    </>
  );
}

function SmokeColumn() {
  const smoke = useRef();
  useFrame(({ clock }) => {
    if (!smoke.current) return;
    smoke.current.children.forEach((child, index) => {
      child.position.y = 5 + ((clock.elapsedTime * (1.8 + index * 0.08) + index * 3.4) % 25);
      child.position.x = Math.sin(clock.elapsedTime * 0.7 + index) * (1.2 + index * 0.2);
      child.scale.setScalar(1 + child.position.y / 20);
    });
  });
  return (
    <group ref={smoke}>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={`smoke-${index}`} position={[0, 4 + index * 3, 0]}>
          <sphereGeometry args={[1.8 + index * 0.32, 9, 7]} />
          <meshStandardMaterial color={index < 3 ? "#34373a" : "#5c6063"} transparent opacity={0.32} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function ElectricalArcs() {
  const arcs = useRef();
  useFrame(({ clock }) => {
    if (!arcs.current) return;
    arcs.current.rotation.y = clock.elapsedTime * 3.6;
    arcs.current.scale.setScalar(0.9 + Math.sin(clock.elapsedTime * 18) * 0.18);
  });
  return (
    <group ref={arcs} position={[0, 6, 0]}>
      {[0, 1, 2, 3].map((index) => (
        <mesh key={`arc-${index}`} rotation={[0, (Math.PI / 2) * index, Math.PI / 3]}>
          <torusGeometry args={[4 + index * 0.35, 0.11, 5, 20, Math.PI * 0.72]} />
          <meshBasicMaterial color="#b8efff" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* Where each hazard happens and how it is drawn. Regional campuses resolve to
 * their real energy assets from the campus profile, so faults appear on the
 * substation, battery, PV array or turbine nacelle instead of a fixed point. */
export function hazardSite(type, variant = "regional", profile) {
  if (variant === "vit") {
    const vit = {
      overload: [-220, 112],
      transformerFire: [-220, 112],
      batteryThermal: [-175, 112],
      solarDcFire: [-115, 112],
      windOverspeed: [-175, 180],
      lightningStrike: [-220, 75],
    };
    const [x, z] = vit[type] || vit.overload;
    return { position: [x, 0.4, z], height: 0, kind: "legacy" };
  }
  const grid = profile?.grid || [0, 0];
  const battery = profile?.battery || [-125, 86];
  const solar = profile?.solar || [-180, 100];
  const turbine = profile?.turbines?.[0] || [175, 86, 1];
  const sites = {
    overload: { at: grid, height: 7, kind: "arc" },
    transformerFire: { at: grid, height: 6, kind: "fire" },
    batteryThermal: { at: battery, height: 6.2, kind: "battery" },
    solarDcFire: { at: [solar[0] + 14, solar[1] + 12], height: 1.4, kind: "smallFire" },
    windOverspeed: { at: turbine, height: 43.3 * (turbine[2] || 1), kind: "nacelle" },
    lightningStrike: { at: grid, height: 13, kind: "lightning" },
  };
  const site = sites[type] || sites.overload;
  return { position: [site.at[0], 0.4, site.at[1]], height: site.height, kind: site.kind };
}

function Flames({ scale = 1 }) {
  const flames = useRef();
  useFrame(({ clock }) => {
    if (!flames.current) return;
    flames.current.children.forEach((child, index) => {
      const flicker = 0.82 + Math.abs(Math.sin(clock.elapsedTime * (9 + index * 2.3) + index)) * 0.36;
      child.scale.set(1, flicker, 1);
    });
  });
  return (
    <group ref={flames} scale={scale}>
      <mesh position={[0, 2.6, 0]}>
        <coneGeometry args={[3, 6.2, 9]} />
        <meshBasicMaterial color="#ff6a1f" transparent opacity={0.78} depthWrite={false} />
      </mesh>
      <mesh position={[1.4, 1.8, 0.8]}>
        <coneGeometry args={[1.7, 4.2, 8]} />
        <meshBasicMaterial color="#ff9a2e" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh position={[-1.2, 1.6, -0.9]}>
        <coneGeometry args={[1.5, 3.6, 8]} />
        <meshBasicMaterial color="#ffc04a" transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <pointLight color="#ff7a2c" intensity={14} distance={45} decay={2} position={[0, 3, 0]} userData={{ preserveDuringBlackout: true }} />
    </group>
  );
}

function LightningBolt({ height = 95 }) {
  const bolt = useRef();
  const flash = useRef();
  const points = useMemo(() => {
    const list = [];
    const steps = 14;
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const wander = index === 0 || index === steps ? 0 : (Math.sin(index * 12.9898) * 43758.5453 % 1) * 7;
      list.push(new THREE.Vector3(wander, height * (1 - t), wander * 0.6 - 2));
    }
    return list;
  }, [height]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, false, "catmullrom", 0), [points]);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 48, 0.55, 6, false), [curve]);
  const glowGeometry = useMemo(() => new THREE.TubeGeometry(curve, 48, 1.8, 8, false), [curve]);
  useFrame(({ clock }) => {
    const on = Math.sin(clock.elapsedTime * 31) > -0.2 && Math.sin(clock.elapsedTime * 7.3) > -0.6;
    if (bolt.current) bolt.current.visible = on;
    if (flash.current) flash.current.intensity = on ? 60 : 4;
  });
  return (
    <group>
      <group ref={bolt}>
        <mesh geometry={geometry}>
          <meshBasicMaterial color="#f4fbff" toneMapped={false} />
        </mesh>
        <mesh geometry={glowGeometry}>
          <meshBasicMaterial color="#7fb8ff" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={flash} color="#cfe6ff" intensity={40} distance={160} decay={1.6} position={[0, 20, 0]} userData={{ preserveDuringBlackout: true }} />
    </group>
  );
}

export function HazardSceneEffect({ hazard, variant = "regional", profile }) {
  const site = useMemo(() => hazardSite(hazard?.type, variant, profile), [hazard?.type, profile, variant]);

  if (!hazard || hazard.phase === "idle") return null;
  const fault = hazard.phase === "fault";
  const active = fault || hazard.phase === "tripped";
  const { kind, height } = site;
  return (
    <group position={site.position}>
      <FaultPulse phase={hazard.phase} />
      {/* The strike itself precedes the trip: show it through warning and fault. */}
      {kind === "lightning" && (hazard.phase === "warning" || fault) && (
        <group position={[0, height, 0]}><LightningBolt /></group>
      )}
      {active && kind === "legacy" && (
        <>
          <ElectricalArcs />
          <SmokeColumn />
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[3.2, 6.5, 9]} />
            <meshBasicMaterial color="#ff7b2c" transparent opacity={0.72} />
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <sphereGeometry args={[4.2, 14, 10]} />
            <meshBasicMaterial color="#ffbe52" transparent opacity={fault ? 0.72 : 0.28} />
          </mesh>
        </>
      )}
      {active && kind !== "legacy" && (
        <group position={[0, height, 0]}>
          {kind === "arc" && (
            <>
              {fault && <ElectricalArcs />}
              {fault && (
                <mesh position={[0, 6, 0]}>
                  <sphereGeometry args={[3.2, 14, 10]} />
                  <meshBasicMaterial color="#dff4ff" transparent opacity={0.55} toneMapped={false} depthWrite={false} />
                </mesh>
              )}
              <group scale={0.6} position={[0, -4, 0]}><SmokeColumn /></group>
            </>
          )}
          {kind === "fire" && (
            <>
              <Flames />
              {fault && <ElectricalArcs />}
              <SmokeColumn />
            </>
          )}
          {kind === "battery" && (
            <>
              <Flames scale={fault ? 1.1 : 0.7} />
              <SmokeColumn />
            </>
          )}
          {kind === "smallFire" && (
            <>
              <Flames scale={fault ? 0.6 : 0.35} />
              <group scale={0.7} position={[0, -3, 0]}><SmokeColumn /></group>
            </>
          )}
          {kind === "nacelle" && (
            <>
              {fault && <group scale={0.45} position={[0, -6, 0]}><ElectricalArcs /></group>}
              <group scale={0.55} position={[0, -3, 0]}><SmokeColumn /></group>
            </>
          )}
          {kind === "lightning" && (
            <>
              {fault && <ElectricalArcs />}
              <group scale={0.6} position={[0, -4, 0]}><SmokeColumn /></group>
            </>
          )}
        </group>
      )}
      <Html position={[0, height + 13, 0]} center distanceFactor={120}>
        <div className={`hazard-scene-label phase-${hazard.phase}`}>
          <span>{hazard.phase === "warning" ? "WARNING" : hazard.phase === "tripped" ? "ISOLATED" : hazard.phase === "recovering" ? "RESTORING" : "FAULT"}</span>
          <b>{hazard.label}</b>
          <small>{hazard.phase === "tripped" ? "Protection breaker open • energy flow stopped" : "Protection sequence active"}</small>
        </div>
      </Html>
    </group>
  );
}
