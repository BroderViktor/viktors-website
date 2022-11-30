import React, { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber"
import Navbar from "../components/navbar";
import * as THREE from 'three'

function PointManger() {
    const pointManager = useRef()

    useFrame((state, delta) => {

    })

    useEffect(() => {
        
        
        pointManager.current.setMatrixAt(0, new THREE.Matrix4())
        let m = new THREE.Matrix4()
        m.setPosition(new THREE.Vector3(0.1,0.1,0.1))
        pointManager.current.setMatrixAt(1, m)
    }, [])
    return (
        <instancedMesh ref={pointManager} args={[null,null,2]}>
            <circleGeometry args={[0.010]}/>
            <meshStandardMaterial color={[1,1,1]}/>
        </instancedMesh>
    )
}

export default function TestPage() {
    return (
        <>
        <Navbar/>
        <div className="CanvasMainBackground">
            <Canvas camera={{position: [0, 0, 100], zoom: 50}}>
                <ambientLight intensity={1}/>
                <PointManger/>
            </Canvas>
        </div>

        </>
    )
}