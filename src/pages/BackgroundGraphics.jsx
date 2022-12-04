import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import Navbar from "../components/navbar";
import * as THREE from 'three'
import TestObject from "../assets/test.obj";
import Titlecard from "../assets/plane.obj";
import { useImperativeHandle } from "react";

const particlesNum = 200;
const speed = 1;

async function loadObjData(obj, scale) {
    let objModel = await fetch(obj).then(r => r.text());
    let lines = objModel.split("\n");
    
    let vertices = [];
    lines.forEach(line => {
        if (line[0] == "v" && line[1] == " ") {
            let lineSplit = line.split(" ");
            vertices.push(new THREE.Vector3(lineSplit[1], lineSplit[2], lineSplit[3]).multiplyScalar(scale));
        }
    });
    return vertices;
}

class particle {


    constructor(id, position, velocity, acceleration, octree, viewport) {
        this.xChunkOld = -100;
        this.yChunkOld = -100;
        this.zChunkOld = -100;
        this.id = id;
        this.position = new THREE.Vector3(0);
        this.SetPosition(octree, position, viewport, true)
        this.originalPosition = this.position;
        this.velocity = velocity;
        this.acceleration = acceleration;
        this.targetPos = new THREE.Vector3(0);
        this.active = false;

        this.activeLine = false;
        this.line = -1;
        this.boundParticle = null;
    }
    goToWanted() {
        let dir = new THREE.Vector3(0);  
        dir.sub(this.position);        
        dir.add(this.targetPos);

        this.velocity = new THREE.Vector3(0);
        this.velocity.add(dir.multiplyScalar(this.acceleration));
    }
    SetPosition(octree, newPos, viewport, init = false) {
        let xChunk = Math.floor((newPos.x / (viewport.width + 10)) * octree.x + octree.x/2);
        let yChunk = Math.floor((newPos.y / (viewport.height + 10)) * octree.y + octree.y/2);
        let zChunk = Math.floor((newPos.z / (viewport.height + 10)) * octree.z + octree.z/2);
        

        if (xChunk < 0 || xChunk > octree.x - 1 || yChunk < 0 || yChunk > octree.y - 1 || zChunk < 0 || zChunk > octree.z - 1) { 
            if (!this.active) {
                //console.log("fak")
            }
            return;
        }
        
        if (init) {
            octree.octree[xChunk][yChunk][zChunk].push(this);
            octree.elements++;
            this.xChunkOld = xChunk;
            this.yChunkOld = yChunk;
            this.zChunkOld = zChunk;
        }

        if (xChunk != this.xChunkOld || yChunk != this.yChunkOld || zChunk != this.zChunkOld) {
            octree.octree[this.xChunkOld][this.yChunkOld][this.zChunkOld].splice(octree.octree[this.xChunkOld][this.yChunkOld][this.zChunkOld].indexOf(this), 1);

            octree.elements--;
            octree.octree[xChunk][yChunk][zChunk].push(this);
                        
            octree.elements++;
            this.xChunkOld = xChunk;
            this.yChunkOld = yChunk;
            this.zChunkOld = zChunk;
        }
        this.position = newPos;
    }
}

class worldOctree {

    constructor(input_x, input_y, input_z) {
        this.x = input_x;
        this.y = input_y;
        this.z = input_z;
        this.elements = 0;

        let NumberOfChunks = 0;
        //for hver chunk bortover i x retningen
        this.octree = new Array(this.x);
        for (let x = 0; x < this.x; x++) {

            //for hver chunk oppover i y retningen
            this.octree[x] = new Array(this.y);
            for (let y = 0; y < this.y; y++) {
                
                //for hver chunk innover i z retningen
                this.octree[x][y] = new Array(this.z);
                for (let z = 0; z < this.z; z++) {
                    
                    //Lager arrayen som skal holde partiklene
                    this.octree[x][y][z] = new Array();
                    NumberOfChunks++
                }
            }
        }
        console.log("Octree Created final number of chunks: " + NumberOfChunks)
        console.log(this.octree)
    }
    runCheck() {
        for (let x = 0; x < this.x; x++) {

            for (let y = 0; y < this.y; y++) {
                
                for (let z = 0; z < this.z; z++) {
                    
                    for (let i = 0; i < this.octree[x][y][z].length; i++) {
                        let p = this.octree[x][y][z][i];
                        console.log(x, y, z);
                        console.log(p.xChunkOld, p.yChunkOld, p.zChunkOld);
                    
                    }
                }
            }
        }
    }
}

class StateManager {
    
    constructor(particles) {
        this.currentState = 1
        this.particles = particles;
    }

    async loadStates() {
        this.stateArray = [];
        this.stateArray.push(null)
        this.stateArray.push(await loadObjData(Titlecard, 20))
        this.stateMods = [];
        this.stateMods.push()
    }
    
    changeState() {
        if (this.stateArray[this.currentState] == null) {
            this.particles.forEach(particle => {
                particle.velocity = new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed);
                particle.active = false;
            });
        }
        else {
            for (let i = 0; i < this.stateArray[this.currentState].length; i++) {
                if (this.particles[i] == undefined) break;
                this.particles[i].targetPos = this.stateArray[this.currentState][i];
                this.particles[i].active = true;
            }
        }

        this.currentState = (this.currentState + 1) % this.stateArray.length
    }
}

class MeshManager {
    
    constructor(maxLines) {
        this.linePositions = new Float32Array(maxLines * 3 * 4);
        this.indices = new Uint16Array(maxLines * 3 * 2)

        this.openSpots = []
        this.fillSpot = 0
    }
    addLine(vec1, vec2, width) {
        if (this.fillSpot * 3 * 4 == this.linePositions) return;

        let veca = vec1.x + vec1.y > vec2.x + vec2.y ? vec1 : vec2;
        let vecb = vec1.x + vec1.y < vec2.x + vec2.y ? vec1 : vec2;

        //vert 0
        this.linePositions[this.fillSpot * 3 * 4 + 0] = veca.x - width;
        this.linePositions[this.fillSpot * 3 * 4 + 1] = veca.y;
        this.linePositions[this.fillSpot * 3 * 4 + 2] = veca.z;

        this.linePositions[this.fillSpot * 3 * 4 + 3] = veca.x + width;
        this.linePositions[this.fillSpot * 3 * 4 + 4] = veca.y;
        this.linePositions[this.fillSpot * 3 * 4 + 5] = veca.z;
       
        //vert 1
        this.linePositions[this.fillSpot * 3 * 4 + 6] = vecb.x - width;
        this.linePositions[this.fillSpot * 3 * 4 + 7] = vecb.y;
        this.linePositions[this.fillSpot * 3 * 4 + 8] = vecb.z;

        this.linePositions[this.fillSpot * 3 * 4 + 9] = vecb.x + width;
        this.linePositions[this.fillSpot * 3 * 4 + 10] = vecb.y;
        this.linePositions[this.fillSpot * 3 * 4 + 11] = vecb.z;

        this.indices[this.fillSpot * 3 * 2 + 0] = [this.fillSpot * 4 + 0];
        this.indices[this.fillSpot * 3 * 2 + 1] = [this.fillSpot * 4 + 2];
        this.indices[this.fillSpot * 3 * 2 + 2] = [this.fillSpot * 4 + 3];

        this.indices[this.fillSpot * 3 * 2 + 3] = [this.fillSpot * 4 + 0];
        this.indices[this.fillSpot * 3 * 2 + 4] = [this.fillSpot * 4 + 3];
        this.indices[this.fillSpot * 3 * 2 + 5] = [this.fillSpot * 4 + 1];

        this.fillSpot += 1;
        return (this.fillSpot - 1);
    }   
    updateLine(vec1, vec2, width, index) {
        
        if (index >= this.fillSpot) return;

        let veca = vec1.x + vec1.y > vec2.x + vec2.y ? vec1 : vec2;
        let vecb = vec1.x + vec1.y < vec2.x + vec2.y ? vec1 : vec2;

        //vert 0
        this.linePositions[index * 3 * 4 + 0] = veca.x - width;
        this.linePositions[index * 3 * 4 + 1] = veca.y;
        this.linePositions[index * 3 * 4 + 2] = veca.z;

        this.linePositions[index * 3 * 4 + 3] = veca.x + width;
        this.linePositions[index * 3 * 4 + 4] = veca.y;
        this.linePositions[index * 3 * 4 + 5] = veca.z;
       
        //vert 1
        this.linePositions[index * 3 * 4 + 6] = vecb.x - width;
        this.linePositions[index * 3 * 4 + 7] = vecb.y;
        this.linePositions[index * 3 * 4 + 8] = vecb.z;

        this.linePositions[index * 3 * 4 + 9] = vecb.x + width;
        this.linePositions[index * 3 * 4 + 10] = vecb.y;
        this.linePositions[index * 3 * 4 + 11] = vecb.z;

        this.indices[index * 3 * 2 + 0] = [index * 4 + 0];
        this.indices[index * 3 * 2 + 1] = [index * 4 + 2];
        this.indices[index * 3 * 2 + 2] = [index * 4 + 3];

        this.indices[index * 3 * 2 + 3] = [index * 4 + 0];
        this.indices[index * 3 * 2 + 4] = [index * 4 + 3];
        this.indices[index * 3 * 2 + 5] = [index * 4 + 1];
    }   
}

const PointManager = React.forwardRef((props, ref) => {
    const {viewport} = useThree();
    const pointManager = useRef();
    const meshBuffer = useRef();

    function repeatingState() {
        setTimeout(() => {
            //changeState()
            setTimeout(() => {
                particles.forEach(particle => {
                    particle.velocity = new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed);
                    particle.active = false;
                });
                repeatingState();
            }, 3000)
            
        }, 4000);
    }

    useImperativeHandle(ref, () => ({
        async changeState() {
            let data = await loadObjData(Titlecard, 20);
    
            for (let i = 0; i < data.length; i++) {
                if (particles[i] == undefined) break;
                particles[i].targetPos = data[i];
                particles[i].active = true;
            }
        },
        GetStateManager() {
            return stateManager;
        }
    }));


    const {particles, octree, stateManager} = useMemo(() => {
        
        let octree = new worldOctree(1,1,1)

        let particles = new Array(particlesNum);
        for (let i = 0; i < particles.length; i++) {
            let pos = new THREE.Vector3((Math.random() - 0.5) * viewport.width, (Math.random() - 0.5) * viewport.height, 0)
            let vel = new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed)
            particles[i] = new particle(i, pos, vel, 0.05, octree, viewport)
        }


        //repeatingState();
        let stateManager = new StateManager(particles);
        stateManager.loadStates();
        

        return {particles, octree, stateManager}; 
    }, [])

    

    useFrame(({clock}) => {
        //octree.runCheck();

        //console.log(meshManager.fillSpot)
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].active) {
                particles[i].goToWanted()
            }

            if (!particles[i].activeLine) {
                let closeParticles = octree.octree[particles[i].xChunkOld][particles[i].yChunkOld][particles[i].zChunkOld];
                let closestDistance = Infinity;
                let closestParticle = null;
                closeParticles.forEach((particle) => {
                    if (particles[i].position == particle.position || particle.activeLine) return;
                    
                    let dis = particles[i].position.distanceToSquared(particle.position);
                    if (dis < closestDistance) { 
                        closestDistance = dis; 
                        closestParticle = particle;
                    }
                })
                let r = Math.random() > 0.9;

                if (closestDistance < 2000 && r) {
                    particles[i].activeLine = true;
                    particles[i].boundParticle = closestParticle;
                    particles[i].line = meshManager.addLine(particles[i].position, closestParticle.position, 0.1);
                    closestParticle.activeLine = true;
                    closestParticle.boundParticle = particles[i];
                    closestParticle.line = particles[i].line;
                }
            }
            else {
                meshManager.updateLine(particles[i].position, particles[i].boundParticle.position, 0.1, particles[i].line)
                if (particles[i].position.distanceToSquared(particles[i].boundParticle.position) > 2000) {
                    meshManager.updateLine(new THREE.Vector3(-1000, -1000, 1000), new THREE.Vector3(-1000, -1000, 1000), 0.0,  particles[i].line);
                    
                    particles[i].activeLine = false;
                    particles[i].line = -1;
                    
                    particles[i].boundParticle.activeLine = false;
                    particles[i].boundParticle.boundParticle = null;
                    particles[i].boundParticle.line = -1;

                    particles[i].boundParticle = null;
                }
            }
            

            particles[i].SetPosition(octree, particles[i].position.add(particles[i].velocity), viewport);

            if (particles[i].position.x < -0.5 * viewport.width || particles[i].position.x > 0.5 * viewport.width) particles[i].velocity.setX(-1 * particles[i].velocity.x)
            if (particles[i].position.y < -0.5 * viewport.height || particles[i].position.y > 0.5 * viewport.height) particles[i].velocity.setY(-1 * particles[i].velocity.y)
            if (particles[i].position.z < -0.5 * viewport.height || particles[i].position.z > 0.5 * viewport.height) particles[i].velocity.setZ(-1 * particles[i].velocity.z)
                
            let col = new THREE.Color(particles[i].xChunkOld / 4, particles[i].yChunkOld / 4, particles[i].zChunkOld / 4)
            let transform = new THREE.Matrix4()
            transform.setPosition(particles[i].position)
            pointManager.current.setColorAt(i, col);
            pointManager.current.setMatrixAt(i, transform)
            
        }
        meshBuffer.current.attributes.position.needsUpdate = true;
        pointManager.current.instanceMatrix.needsUpdate = true
        pointManager.current.instanceColor.needsUpdate = true
    })
        
    const meshManager = new MeshManager(100);


    return (
<>
        <instancedMesh ref={pointManager} args={[null,null,particlesNum]}>
            <circleGeometry args={[0.8]}/>
            <meshStandardMaterial color={[1,1,1]}/>
        </instancedMesh>
        
        <mesh>
            <bufferGeometry ref={meshBuffer}>
                <bufferAttribute 
                    attach={"attributes-position"} 
                    array={meshManager.linePositions} 
                    count={meshManager.linePositions.length / 4}
                    itemSize={3}/>
                <bufferAttribute 
                    attach={"index"} 
                    array={meshManager.indices} 
                    count={meshManager.indices.length}
                    itemSize={1}/>

                <meshStandardMaterial
                    vertexColors
                    side={THREE.BackSide}/>
            </bufferGeometry>
        </mesh>
</>


    )
    //


    /*<line ref={ref} geometry={lineGeometry}>
                <lineBasicMaterial attach="material" color={'#9c88ff'} linewidth={10} linecap={'round'} linejoin={'round'} />
            </line>) */
    //<meshStandardMaterial color={[1,1,1]}/>*/

    /*        
    <instancedMesh ref={pointManager} args={[null,null,1]}>
        
    </instancedMesh>
            <mesh>

            <circleGeometry args={[0.8]}/>
            <meshStandardMaterial color={[1,1,1]}/>

        </mesh>
    */
})

export default function Background() {
    const PointManagerRef = useRef(null);

    return (
        <>
            <div className="CanvasMainBackground">
                <Canvas camera={{position: [0, 0, 100], zoom: 1}}>
                    <ambientLight intensity={1}/>
                    <PointManager ref={PointManagerRef}/>
                </Canvas>
            </div>
            <button onClick={() => PointManagerRef.current.GetStateManager().ChangeState()}>Change State</button>
            <button onClick={() => window.location.reload(false)}>update State</button>
        </>
    )
}