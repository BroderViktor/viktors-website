import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import Navbar from "../components/navbar";
import * as THREE from 'three'

const particlesNum = 100;
const speed = 1;

class particle {
    constructor(position, velocity, targetPos, active) {
        this.position = position;
        this.velocity = velocity;
        this.targetPos = targetPos;
        this.active = active;
    }
}

function PointManger() {
    const {viewport} = useThree();
    const pointManager = useRef();
    const [moveToWanted, setMoveToWanted] = useState(false);
    const [wantedPositions, setWantedPositions] = useState(null);

    if (pointManager.current !== undefined && wantedPositions == null) { 
        setWantedPositions(pointManager.current.geometry.attributes.position.array) 
        console.log(pointManager.current.geometry.attributes.position.array)
        setMoveToWanted(true)
    }

    const {particles } = useMemo(() => {
        let particles = new Array(particlesNum);
        for (let i = 0; i < particles.length; i++) {
            let pos = new THREE.Vector3((Math.random() - 0.5) * viewport.width, (Math.random() - 0.5) * viewport.height, 0)
            let vel = new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed)
            let target = new THREE.Vector3(0)
            particles[i] = new particle(pos, vel, target, false)
        }
        return {particles}; 
    }, [])
    
    useFrame(() => {
        //if (moveToWanted) console.log(wantedPositions);
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].active) {
                let size = 20;
                //particles[i].velocity.set(wantedPositions[3 * i] * size, wantedPositions[3 * i + 1] * size, wantedPositions[3 * i + 2] * size);
            }
            else {
                particles[i].position.add(particles[i].velocity);
                if (particles[i].position.x < -0.5 * viewport.width || particles[i].position.x > 0.5 * viewport.width) particles[i].velocity.setX(-1 * particles[i].velocity.x)
                if (particles[i].position.y < -0.5 * viewport.height || particles[i].position.y > 0.5 * viewport.height) particles[i].velocity.setY(-1 * particles[i].velocity.y)
            }
            let transform = new THREE.Matrix4()
            transform.setPosition(particles[i].position)
            pointManager.current.setMatrixAt(i, transform)
        }
        pointManager.current.instanceMatrix.needsUpdate = true
    })
    return (
        <instancedMesh ref={pointManager} args={[null,null,particlesNum]}>
            <circleGeometry args={[0.5]}/>
            <meshStandardMaterial color={[1,1,1]}/>
        </instancedMesh>
    )
}

export default function TestPage() {
    return (
        <>
        <Navbar/>
        <div className="CanvasMainBackground">
            <Canvas camera={{position: [0, 0, 100], zoom: 1}}>
                <ambientLight intensity={1}/>
                <PointManger/>
            </Canvas>
        </div>

        </>
    )
}