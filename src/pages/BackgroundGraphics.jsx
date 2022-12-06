import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import Navbar from "../components/navbar";
import * as THREE from 'three'
import TestObject from "../assets/test.obj";
import Titlecard from "../assets/title.obj";
import Plane from "../assets/plane.obj";
import { useImperativeHandle } from "react";

const particlesNum = 400;
const linesNum = 200;
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
    constructor(id, position, velocity, acceleration, octree, viewport, lineCenter) {
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

        this.lineCenter      = lineCenter;
        this.lineConnectionsIndex = [];
        this.boundParticles  = [];

        this.lineIndex      = -1;
        this.parentParticle = null;
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
        let changedChunk = false;

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
            changedChunk = true;
        }
        this.position = newPos;
        return changedChunk;
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
        this.stateArray.push(await loadObjData(Titlecard, 30))
        this.stateArray.push(await loadObjData(Plane, 10))
        this.stateArray.push(await loadObjData(TestObject, 10))
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
        this.indices = new Uint16Array(maxLines * 3 * 2);
        this.numLines = 0;
        this.openSpots = [];
        this.fillSpot = 0;
    }
    addLine(vec1, vec2, width) {
        let index = this.fillSpot
        let usedOpenSpot = false;
        if (this.openSpots.length > 0) {
            index = this.openSpots.pop()
            usedOpenSpot = true
        }
        if ((index * 3 * 4) >= this.linePositions.length) {  
            console.log("max cap"); 
            return;
        }

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

        this.indices[index * 3 * 4 + 0] = [index * 4 + 0];
        this.indices[index * 3 * 4 + 1] = [index * 4 + 2];
        this.indices[index * 3 * 4 + 2] = [index * 4 + 3];

        this.indices[index * 3 * 4 + 3] = [index * 4 + 0];
        this.indices[index * 3 * 4 + 4] = [index * 4 + 3];
        this.indices[index * 3 * 4 + 5] = [index * 4 + 1];

        this.indices[index * 3 * 4 + 6] = [index * 4 + 0];
        this.indices[index * 3 * 4 + 7] = [index * 4 + 2];
        this.indices[index * 3 * 4 + 8] = [index * 4 + 3];

        this.indices[index * 3 * 4 + 9] = [index * 4 + 0];
        this.indices[index * 3 * 4 + 10] = [index * 4 + 3];
        this.indices[index * 3 * 4 + 11] = [index * 4 + 1];
        
        if (!usedOpenSpot) this.fillSpot += 1;
        
        this.numLines++;   

        return (index);
    }   
    updateLine(vec1, vec2, width, index) {
        
        if (index >= this.fillSpot) console.log(this.fillSpot);

        let veca = vec1.x + vec1.y > vec2.x + vec2.y ? vec1 : vec2;
        let vecb = vec1.x + vec1.y < vec2.x + vec2.y ? vec1 : vec2;

        let xdiff = Math.abs(veca.x - vecb.x);
        xdiff = Math.abs(veca.x - vecb.x) /  (xdiff + Math.abs(veca.y - vecb.y));
        let ydiff = Math.abs(veca.y - vecb.y);
        ydiff = ydiff /  (ydiff + Math.abs(veca.x - vecb.x));
        let xwidth = width * xdiff;   
        let ywidth = width * ydiff;
        //vert 0
        this.linePositions[index * 3 * 4 + 0] = veca.x + xwidth;
        this.linePositions[index * 3 * 4 + 1] = veca.y + ywidth;
        this.linePositions[index * 3 * 4 + 2] = veca.z;

        this.linePositions[index * 3 * 4 + 3] = veca.x - xwidth;
        this.linePositions[index * 3 * 4 + 4] = veca.y - ywidth;
        this.linePositions[index * 3 * 4 + 5] = veca.z;
       
        //vert 1
        this.linePositions[index * 3 * 4 + 6] = vecb.x + xwidth;
        this.linePositions[index * 3 * 4 + 7] = vecb.y + ywidth;
        this.linePositions[index * 3 * 4 + 8] = vecb.z;

        this.linePositions[index * 3 * 4 + 9] = vecb.x - xwidth;
        this.linePositions[index * 3 * 4 + 10] = vecb.y - ywidth;
        this.linePositions[index * 3 * 4 + 11] = vecb.z;
    }  
    removeLine(index) {
        if (index >= this.fillSpot) { console.log("fefe"); return; }

        this.linePositions[index * 3 * 4 + 0] = 0;
        this.linePositions[index * 3 * 4 + 1] = 0;
        this.linePositions[index * 3 * 4 + 2] = 0;

        this.linePositions[index * 3 * 4 + 3] = 0;
        this.linePositions[index * 3 * 4 + 4] = 0;
        this.linePositions[index * 3 * 4 + 5] = 0;
       
        //vert 1
        this.linePositions[index * 3 * 4 + 6] = 0;
        this.linePositions[index * 3 * 4 + 7] = 0;
        this.linePositions[index * 3 * 4 + 8] = 0;

        this.linePositions[index * 3 * 4 + 9] = 0;
        this.linePositions[index * 3 * 4 + 10] = 0;
        this.linePositions[index * 3 * 4 + 11] = 0;
        
        this.indices[index * 3 * 4 + 0] = [0];
        this.indices[index * 3 * 4 + 1] = [0];
        this.indices[index * 3 * 4 + 2] = [0];

        this.indices[index * 3 * 4 + 3] = [0];
        this.indices[index * 3 * 4 + 4] = [0];
        this.indices[index * 3 * 4 + 5] = [0];

        this.indices[index * 3 * 4 + 6] = [0];
        this.indices[index * 3 * 4 + 7] = [0];
        this.indices[index * 3 * 4 + 8] = [0];

        this.indices[index * 3 * 4 + 9] = [0];
        this.indices[index * 3 * 4 + 10] = [0];
        this.indices[index * 3 * 4 + 11] = [0];
        
        this.numLines--;
        //console.log("removed", index)
        this.openSpots.push(index)
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
        ChangeState() {
            stateManager.changeState();
        }
    }));


    const {particles, octree, stateManager, meshManager} = useMemo(() => {
        
        let octree = new worldOctree(3,3,3)

        let particles = new Array(particlesNum);
        for (let i = 0; i < particles.length; i++) {
            //let pos = new THREE.Vector3((Math.random() - 0.5) * viewport.width, (Math.random() - 0.5) * viewport.height, 0)
            let pos = new THREE.Vector3(0,0,0);
            //let vel = new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed)
            let vel = i <= -1 ? new THREE.Vector3(0,0,0) : new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed)
            //let vel = new THREE.Vector3(0,0,0)
            particles[i] = new particle(i, pos, vel, 0.05, octree, viewport, i % 10 == 0);
        }


        //repeatingState();
        let stateManager = new StateManager(particles);
        stateManager.loadStates();
        let meshManager = new MeshManager(linesNum);

        return {particles, octree, stateManager, meshManager}; 
    }, [])


    useFrame(({clock}) => {
        //octree.runCheck();
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].active) {
                particles[i].goToWanted()
            }

            particles[i].SetPosition(octree, particles[i].position.add(particles[i].velocity), viewport);
            //console.log(particles[i].boundParticles.length)

            if (particles[i].lineCenter) {
                let ParticlesInChunk = octree.octree[particles[i].xChunkOld][particles[i].yChunkOld][particles[i].zChunkOld];
                /*console.log("num in chunk" + ParticlesInChunk.length)
                console.log("num lines" + particles[i].lineConnectionsIndex.length)*/
                ParticlesInChunk.forEach((chunkParticle) => {
                    if (chunkParticle == particles[i] || chunkParticle.lineCenter || chunkParticle.parentParticle != null) return;
                    

                    let newLineIndex = meshManager.addLine(particles[i].position, chunkParticle.position, 0.1)
                    
                    particles[i].boundParticles.push(chunkParticle);
                    chunkParticle.parentParticle = particles[i];

                    particles[i].lineConnectionsIndex.push(newLineIndex);
                    chunkParticle.lineIndex = newLineIndex;
                })
                 
                let numLinesActive = 0;
                for (let l = 0; l < meshManager.linePositions.length / 12; l++) {
                    if (meshManager.linePositions[l * 12] != 0) numLinesActive++;
                }
                /*
                if (numLinesActive != ParticlesInChunk.length) { 
                    console.log("error! 1"); 
                    console.log("real lines: ", numLinesActive); 
                    
                } else { console.log("ok! 1")}*/
                //Update and check every particle bonded to this parent particle
                for (let child = 0; child < particles[i].boundParticles.length; child++) {
                    
                    let childParticle = particles[i].boundParticles[child];
                    
                    let sameChunk = (particles[i].xChunkOld == childParticle.xChunkOld && particles[i].yChunkOld == childParticle.yChunkOld && particles[i].zChunkOld == childParticle.zChunkOld )
                    
                    //update if they are in the same chunk
                    if (sameChunk) {
                        //console.log("update")
                        meshManager.updateLine(particles[i].position, childParticle.position, 0.1, childParticle.lineIndex)
                    }
                    //remove the connection if they are in different chunks
                    else {
                        childParticle.parentParticle = null;
                        meshManager.removeLine(childParticle.lineIndex);
                        childParticle.line = [];

                        particles[i].boundParticles.splice(child, 1)
                        particles[i].lineConnectionsIndex.splice(child, 1)
                    }
                }
                /*numLinesActive = 0;
                for (let l = 0; l < meshManager.linePositions.length / 12; l++) {
                    if (meshManager.linePositions[l * 12] != 0) numLinesActive++;
                }
                if (numLinesActive != meshManager.numLines) { 
                    console.log("error! 2"); 
                    console.log("num lines: ", meshManager.numLines); 
                    console.log("real lines: ", numLinesActive); 
                    console.log(structuredClone(meshManager.linePositions));
                    
                } else { console.log("ok! 2")}*/
            }
/*
            if (!particles[i].activeLine) {
                let ParticlesInChunk = octree.octree[particles[i].xChunkOld][particles[i].yChunkOld][particles[i].zChunkOld];
                let closestDistance = Infinity;
                let closestParticle = null;
                ParticlesInChunk.forEach((particle) => {
                    if (particles[i].position == particle.position || particle.activeLine) return;
                    
                    let dis = particles[i].position.distanceToSquared(particle.position);
                    if (dis < closestDistance) { 
                        closestDistance = dis; 
                        closestParticle = particle;
                    }
                })

                if (closestDistance < 2000) {
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
                    meshManager.removeLine(particles[i].line);
                    
                    particles[i].boundParticle.activeLine = false;
                    particles[i].boundParticle.boundParticle = null;
                    particles[i].boundParticle.line = -1;

                    particles[i].activeLine = false;
                    particles[i].line = -1;
                    particles[i].boundParticle = null;
                }
            }*/
            if (particles[i].position.x < -0.5 * viewport.width || particles[i].position.x > 0.5 * viewport.width) particles[i].velocity.setX(-1 * particles[i].velocity.x)
            if (particles[i].position.y < -0.5 * viewport.height || particles[i].position.y > 0.5 * viewport.height) particles[i].velocity.setY(-1 * particles[i].velocity.y)
            if (particles[i].position.z < -0.5 * viewport.height || particles[i].position.z > 0.5 * viewport.height) particles[i].velocity.setZ(-1 * particles[i].velocity.z)
                
            let col = new THREE.Color(particles[i].xChunkOld / 4, particles[i].yChunkOld / 4, particles[i].zChunkOld / 4)
            let transform = new THREE.Matrix4()
            transform.setPosition(particles[i].position)
            //pointManager.current.setColorAt(i, col);
            pointManager.current.setMatrixAt(i, transform)
            
        }
        meshBuffer.current.attributes.position.needsUpdate = true;
        pointManager.current.instanceMatrix.needsUpdate = true
        //pointManager.current.instanceColor.needsUpdate = true
    })
    
    function testFrame() {
        
        for (let i = 0; i < particles.length; i++) {
            
            if (particles[i].active) {
                particles[i].goToWanted()
            }

            particles[i].SetPosition(octree, particles[i].position.add(particles[i].velocity), viewport);

            if (particles[i].lineCenter) {
                let ParticlesInChunk = octree.octree[particles[i].xChunkOld][particles[i].yChunkOld][particles[i].zChunkOld];

                ParticlesInChunk.forEach((chunkParticle) => {
                    if (chunkParticle == particles[i] || chunkParticle.lineCenter || chunkParticle.parentParticle != null) return;
                    

                    let newLineIndex = meshManager.addLine(particles[i].position, chunkParticle.position, 0.1)
                    
                    particles[i].boundParticles.push(chunkParticle);
                    chunkParticle.parentParticle = particles[i];

                    particles[i].lineConnectionsIndex.push(newLineIndex);
                    chunkParticle.lineIndex = newLineIndex;
                })

                for (let child = 0; child < particles[i].boundParticles.length; child++) {
                    
                    let childParticle = particles[i].boundParticles[child];
                    
                    let sameChunk = (particles[i].xChunkOld == childParticle.xChunkOld && particles[i].yChunkOld == childParticle.yChunkOld && particles[i].zChunkOld == childParticle.zChunkOld )
                    //update if they are in the same chunk
                    if (sameChunk) {
                        meshManager.updateLine(particles[i].position, childParticle.position, 0.1, childParticle.line)
                    }
                    //remove the connection if they are in different chunks
                    else {
                        childParticle.parentParticle = null;
                        console.log("remove", childParticle.lineIndex)
                        meshManager.removeLine(childParticle.lineIndex);
                        childParticle.line = [];

                        particles[i].boundParticles.splice(child, 1)
                        particles[i].lineConnectionsIndex.splice(child, 1)
                    }
                }
            }
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
    }

    


    return (
<>
        <instancedMesh ref={pointManager} args={[null,null,particlesNum]}>
            <circleGeometry args={[0.8]}/>
            <meshStandardMaterial color={[0,0,0,0]}/>
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
            <button onClick={() => PointManagerRef.current.ChangeState()}>Change State</button>
        </>
    )
}