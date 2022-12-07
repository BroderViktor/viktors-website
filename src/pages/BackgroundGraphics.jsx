import React, { Children, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import Navbar from "../components/navbar";
import * as THREE from 'three'
import TestObject from "../assets/test.obj";
import Titlecard from "../assets/title.obj";
import Plane from "../assets/plane.obj";
import { useImperativeHandle } from "react";

const particlesNum = 100;
const linesNum = 200;
const lineSize = 0.1;
const trisNum = 10;
const speed = 0.3;
const particleColor = new THREE.Color(0.3, 0.3, 0.3, 1)
const lineColor = new THREE.Color(1, 0.0, 0.0, 1)

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
    make

    clearLineData(lineManager) {
        if (this.lineCenter) {
            for (let child = 0; child < this.boundParticles.length; child++) {
                let childParticle = this.boundParticles[child]

                lineManager.removeLine(childParticle.lineIndex);

                childParticle.parentParticle = null;
                childParticle.lineIndex = -1;
            }
        }
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

class LineMeshManager {
    
    constructor(maxLines) {
        
        this.linePositions = new Float32Array(maxLines * 3 * 4);
        this.indices = new Uint16Array(maxLines * 3 * 4);
        this.colorArray = new Float32Array(maxLines * 4 * 2)
        for (let i = 0; i < this.colorArray.length; i++) {
            this.colorArray[i] = Math.random();
        }
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

        let xdiff = Math.abs(veca.x - vecb.x);
        xdiff = xdiff / (xdiff + Math.abs(veca.y - vecb.y));

        let ydiff = Math.abs(veca.y - vecb.y);
        ydiff = ydiff / (ydiff + Math.abs(veca.x - vecb.x));

        let xwidth = width * ydiff;   
        let ywidth = width * xdiff;

        //vert 0
        this.linePositions[index * 3 * 4 + 0] = veca.x - xwidth;
        this.linePositions[index * 3 * 4 + 1] = veca.y + ywidth;
        this.linePositions[index * 3 * 4 + 2] = veca.z - 0.001;

        this.linePositions[index * 3 * 4 + 3] = veca.x + xwidth;
        this.linePositions[index * 3 * 4 + 4] = veca.y - ywidth;
        this.linePositions[index * 3 * 4 + 5] = veca.z - 0.001;
       
        //vert 1
        this.linePositions[index * 3 * 4 + 6] = vecb.x - xwidth;
        this.linePositions[index * 3 * 4 + 7] = vecb.y + ywidth;
        this.linePositions[index * 3 * 4 + 8] = vecb.z - 0.001;

        this.linePositions[index * 3 * 4 + 9] = vecb.x + xwidth;
        this.linePositions[index * 3 * 4 + 10] = vecb.y - ywidth;
        this.linePositions[index * 3 * 4 + 11] = vecb.z - 0.001;

        this.indices[index * 3 * 4 + 0] = [index * 4 + 0];
        this.indices[index * 3 * 4 + 1] = [index * 4 + 2];
        this.indices[index * 3 * 4 + 2] = [index * 4 + 3];

        this.indices[index * 3 * 4 + 3] = [index * 4 + 0];
        this.indices[index * 3 * 4 + 4] = [index * 4 + 3];
        this.indices[index * 3 * 4 + 5] = [index * 4 + 1];

        this.indices[index * 3 * 4 + 6] = [index * 4 + 0];
        this.indices[index * 3 * 4 + 7] = [index * 4 + 1];
        this.indices[index * 3 * 4 + 8] = [index * 4 + 2];

        this.indices[index * 3 * 4 + 9] = [index * 4 + 3];
        this.indices[index * 3 * 4 + 10] = [index * 4 + 2];
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
        xdiff = xdiff / (xdiff + Math.abs(veca.y - vecb.y));

        let ydiff = Math.abs(veca.y - vecb.y);
        ydiff = ydiff / (ydiff + Math.abs(veca.x - vecb.x));

        let xwidth = width * ydiff;   
        let ywidth = width * xdiff;

        //vert 0
        this.linePositions[index * 3 * 4 + 0] = veca.x + xwidth;
        this.linePositions[index * 3 * 4 + 1] = veca.y - ywidth;
        this.linePositions[index * 3 * 4 + 2] = veca.z - 0.001;

        this.linePositions[index * 3 * 4 + 3] = veca.x - xwidth;
        this.linePositions[index * 3 * 4 + 4] = veca.y + ywidth;
        this.linePositions[index * 3 * 4 + 5] = veca.z - 0.001;
       
        //vert 1
        this.linePositions[index * 3 * 4 + 6] = vecb.x + xwidth;
        this.linePositions[index * 3 * 4 + 7] = vecb.y - ywidth;
        this.linePositions[index * 3 * 4 + 8] = vecb.z - 0.001;

        this.linePositions[index * 3 * 4 + 9] = vecb.x - xwidth;
        this.linePositions[index * 3 * 4 + 10] = vecb.y + ywidth;
        this.linePositions[index * 3 * 4 + 11] = vecb.z - 0.001;
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
    removeAllLines() {
        for (let i = 0; i < this.fillSpot; i++) {
            this.removeLine(i);
        }
    }
}

class triangleData {
    constructor(p1, p2, p3, index) {
        this.p1 = p1;
        this.p2 = p2;
        this.p3 = p3;
        this.index = index
    } 
}

class TriangleMeshManager {
    constructor(maxTris) {
        this.linePositions = new Float32Array(maxTris * 3 * 3);
        this.indices = new Uint16Array(maxTris * 3 * 2);
        this.colorArray = new Float32Array(maxTris * 4 * 3)
        for (let i = 0; i < this.colorArray.length; i++) {
            this.colorArray[i] = Math.random();
        }
        this.numTris = 0;
        this.openSpots = [];
        this.fillSpot = 0;
        this.Triangles = [];
    }
    updateAllTriangles() {
        for (let i = 0; i < this.Triangles.length; i++) {
            let tri = this.Triangles[i];
            this.updateTriangle(tri.p1.position, tri.p2.position, tri.p3.position, tri.index)
        }
    }

    makeTriangleFromParticles(p1,p2,p3) {
        let triIndex = this.addTriangle(p1.position, p2.position, p3.position);
        this.Triangles.push(new triangleData(p1,p2,p3,triIndex));
    }

    addTriangle(vec1, vec2, vec3) {
        let index = this.fillSpot
        let usedOpenSpot = false;
        if (this.openSpots.length > 0) {
            index = this.openSpots.pop()
            usedOpenSpot = true
        }
        if ((index * 3 * 3) >= this.linePositions.length) {  
            console.log("max cap"); 
            return;
        }

        this.linePositions[index * 3 * 4 + 0] = vec1.x;
        this.linePositions[index * 3 * 4 + 1] = vec1.y;
        this.linePositions[index * 3 * 4 + 2] = vec1.z;

        this.linePositions[index * 3 * 4 + 3] = vec2.x;
        this.linePositions[index * 3 * 4 + 4] = vec2.y;
        this.linePositions[index * 3 * 4 + 5] = vec2.z;

        this.linePositions[index * 3 * 4 + 6] = vec3.x;
        this.linePositions[index * 3 * 4 + 7] = vec3.y;
        this.linePositions[index * 3 * 4 + 8] = vec3.z;

        this.indices[index * 3 * 2 + 0] = [index * 4 + 0];
        this.indices[index * 3 * 2 + 1] = [index * 4 + 1];
        this.indices[index * 3 * 2 + 2] = [index * 4 + 2];

        this.indices[index * 3 * 2 + 3] = [index * 4 + 0];
        this.indices[index * 3 * 2 + 4] = [index * 4 + 2];
        this.indices[index * 3 * 2 + 5] = [index * 4 + 1];
        
        if (!usedOpenSpot) this.fillSpot += 1;
        
        this.numLines++;   

        return (index);
    }
    updateTriangle(vec1, vec2, vec3, index) {
        
        if (index >= this.fillSpot) console.log(this.fillSpot);

        this.linePositions[index * 3 * 4 + 0] = vec1.x;
        this.linePositions[index * 3 * 4 + 1] = vec1.y;
        this.linePositions[index * 3 * 4 + 2] = vec1.z;

        this.linePositions[index * 3 * 4 + 3] = vec2.x;
        this.linePositions[index * 3 * 4 + 4] = vec2.y;
        this.linePositions[index * 3 * 4 + 5] = vec2.z;

        this.linePositions[index * 3 * 4 + 6] = vec3.x;
        this.linePositions[index * 3 * 4 + 7] = vec3.y;
        this.linePositions[index * 3 * 4 + 8] = vec3.z;
    }  
    removeTriangle(index) {
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
        
        this.indices[index * 3 * 4 + 0] = [0];
        this.indices[index * 3 * 4 + 1] = [0];
        this.indices[index * 3 * 4 + 2] = [0];

        this.indices[index * 3 * 4 + 3] = [0];
        this.indices[index * 3 * 4 + 4] = [0];
        this.indices[index * 3 * 4 + 5] = [0];
        
        this.numLines--;
        this.openSpots.push(index)
    } 
}

const PointManager = React.forwardRef((props, ref) => {
    const {viewport} = useThree();
    const pointManager = useRef();
    const lineMeshBuffer = useRef();
    const triangleMeshBuffer = useRef();
    const test = useRef();

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


    const {particles, octree, stateManager, lineManager, triangleManager} = useMemo(() => {
        
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
        let lineManager = new LineMeshManager(linesNum);
        let triangleManager = new TriangleMeshManager(trisNum);

        return {particles, octree, stateManager, lineManager, triangleManager}; 
    }, [])

    useFrame(({clock}) => {

        //triangleManager.updateTriangle(particles[0].position, particles[1].position, particles[2].position, 0)

        for (let i = 0; i < particles.length; i++) {
            if (particles[i].active) {
                particles[i].goToWanted()
            }

            particles[i].SetPosition(octree, particles[i].position.add(particles[i].velocity), viewport);

            if (particles[i].lineCenter) {
                let ParticlesInChunk = octree.octree[particles[i].xChunkOld][particles[i].yChunkOld][particles[i].zChunkOld];
                ParticlesInChunk.forEach((chunkParticle) => {
                    if (chunkParticle == particles[i] || chunkParticle.parentParticle != null) return;
                    
                    let newLineIndex = lineManager.addLine(particles[i].position, chunkParticle.position, lineSize)

                    particles[i].boundParticles.push(chunkParticle);
                    particles[i].lineConnectionsIndex.push(newLineIndex);

                    //hvis det er line center gjør denne ingenting
                    chunkParticle.lineIndex = newLineIndex;
                    chunkParticle.parentParticle = particles[i];
                })
                 /*
                let numLinesActive = 0;
                for (let l = 0; l < lineManager.linePositions.length / 12; l++) {
                    if (lineManager.linePositions[l * 12] != 0) numLinesActive++;
                }
                
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
                        lineManager.updateLine(particles[i].position, childParticle.position, lineSize, particles[i].lineConnectionsIndex[child])
                    }
                    //remove the connection if they are in different chunks
                    else {
                        childParticle.parentParticle = null;
                        lineManager.removeLine(childParticle.lineIndex);
                        childParticle.lineIndex = -1;

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
        triangleMeshBuffer.current.attributes.position.needsUpdate = true;
        //test.current.attributes.position.needsUpdate = true;
        lineMeshBuffer.current.attributes.position.needsUpdate = true;
        lineMeshBuffer.current.attributes.color.needsUpdate = true;
        pointManager.current.instanceMatrix.needsUpdate = true
        //pointManager.current.instanceColor.needsUpdate = true
    })
    const normals = new Float32Array([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
    ])

    const colors = new Float32Array(trisNum * 3 * 4)
    for (let i = 0; i < colors.length; i += 4) {
        colors[i + 0] = 0.01;
        colors[i + 1] = 0.01;
        colors[i + 2] = 0.01;
        colors[i + 3] = 0.3;
    }

    return (
<>
        <mesh renderOrder={-1}>
            <bufferGeometry ref={lineMeshBuffer}>
                <bufferAttribute 
                    attach={"attributes-position"} 
                    array={lineManager.linePositions} 
                    count={lineManager.linePositions.length / 3}
                    itemSize={3}/>
                <bufferAttribute 
                    attach={"attributes-color"} 
                    array={lineManager.colorArray} 
                    count={lineManager.colorArray.length / 4}
                    itemSize={4}/>
                <bufferAttribute 
                    attach={"index"} 
                    array={lineManager.indices} 
                    count={lineManager.indices.length}
                    itemSize={1}/>
            </bufferGeometry>
            <meshBasicMaterial color={lineColor}/>

        </mesh>
        <mesh renderOrder={-1}>
            <bufferGeometry ref={triangleMeshBuffer}>
                <bufferAttribute 
                    attach={"attributes-position"} 
                    array={triangleManager.linePositions} 
                    count={triangleManager.linePositions.length / 3}
                    itemSize={3}/>
                <bufferAttribute
                    attach='attributes-color'
                    array={colors}
                    count={colors.length / 4}
                    itemSize={4}/>
                <bufferAttribute 
                    attach={"index"} 
                    array={triangleManager.indices} 
                    count={triangleManager.indices.length}
                    itemSize={1}/>

            </bufferGeometry>
            <meshStandardMaterial 
                    vertexColors
                    transparent={true}/>
        </mesh>

{/*
        <mesh>
        <bufferGeometry ref={test}>
            <bufferAttribute
                attach='attributes-position'
                array={triangleManager.linePositions} 
                count={triangleManager.linePositions.length / 3}
                itemSize={3}/>
        
            <bufferAttribute
                attach='attributes-color'
                array={colors}
                count={colors.length / 4}
                itemSize={4}
            />
            <bufferAttribute
                attach='attributes-normal'
                array={normals}
                count={normals.length / 3}
                itemSize={3}
            />
            <bufferAttribute
                attach="index"
                array={indices}
                count={indices.length}
                itemSize={1}
            />
        </bufferGeometry>
        <meshStandardMaterial
            vertexColors
            transparent
            side={THREE.DoubleSide}
            
        />
        </mesh>
  */  }
        <instancedMesh ref={pointManager} args={[null,null,particlesNum]} renderOrder={3}>
            <sphereGeometry args={[0.8, 6, 6]}/>
            <meshBasicMaterial color={particleColor}/>
        </instancedMesh>
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