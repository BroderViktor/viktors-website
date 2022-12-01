import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import Navbar from "../components/navbar";
import * as THREE from 'three'

const particlesNum = 11;
const speed = 1;

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

    const {positions, velocitys} = useMemo(() => {
        console.log("generated positions!");
        let positions = new Array(particlesNum);
        let velocitys = new Array(particlesNum);
        for (let i = 0; i < positions.length; i++) {

            positions[i] = new THREE.Vector3((Math.random() - 0.5) * viewport.width, (Math.random() - 0.5) * viewport.height, 0)
            velocitys[i] = new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, 0)
        }
        return {positions, velocitys}; 
    }, [])
    
    useFrame(() => {
        //if (moveToWanted) console.log(wantedPositions);
        for (let i = 0; i < positions.length; i++) {
            if (moveToWanted && i < wantedPositions.length / 3) {
                let size = 20;
                positions[i].set(wantedPositions[3 * i] * size, wantedPositions[3 * i + 1] * size, wantedPositions[3 * i + 2] * size);
            }
            else {
                positions[i].add(velocitys[i]);
                if (positions[i].x < -0.5 * viewport.width || positions[i].x > 0.5 * viewport.width) velocitys[i].setX(-1 * velocitys[i].x)
                if (positions[i].y < -0.5 * viewport.height || positions[i].y > 0.5 * viewport.height) velocitys[i].setY(-1 * velocitys[i].y)
            }
            let transform = new THREE.Matrix4()
            transform.setPosition(positions[i])
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