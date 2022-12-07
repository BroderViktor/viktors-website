import React, { Children, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import Navbar from "../components/navbar";
import * as THREE from 'three'
import TestObject from "../assets/test.obj";
import Titlecard from "../assets/title2.obj";
import Plane from "../assets/plane.obj";
import { useImperativeHandle } from "react";

const particlesNum = 162;
const linesNum = 200;
const lineSize = 0.1;
const trisNum = 150;
const maxTrisLenght = 25000000;
const speed = 0.3;
const particleColor = new THREE.Color(0.1, 0.1, 0.1)
const lineColor = new THREE.Color(0.1, 0.1, 0.1)
const trisColor = new THREE.Color(0, 0, 0)

async function loadObjData(obj, scale) {
    let objModel = await fetch(obj).then(r => r.text());
    let lines = objModel.split("\n");
    
    let vertices = [];
    let indices = [];
    lines.forEach(line => {
        if (line[0] == "v" && line[1] == " ") {
            let lineSplit = line.split(" ");
            let posRaw = new THREE.Vector3(lineSplit[1], lineSplit[2], lineSplit[3])
            vertices.push(posRaw.multiplyScalar(scale));
        }
        if (line[0] == "f" && line[1] == " ") {
            let lineSplit = line.split(" ");
            indices.push([lineSplit[1].split("/")[0] - 1, lineSplit[2].split("/")[0] - 1, lineSplit[3].split("/")[0] - 1]);
        }
    });
    return [vertices, indices];
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

        this.activeTriangles = []
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
    
    constructor(particles, linesManager, triangleManager, triangleBufferRef) {
        this.currentState = 1
        this.particles = particles;
        this.noLines = false;
        this.linesManager = linesManager;
        this.triangleManager = triangleManager;
        this.triangleBufferRef = triangleBufferRef;
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
        this.noLines = true;
        this.linesManager.removeAllLines();
        this.triangleManager.clearAll();
        if (this.stateArray[this.currentState] == null) {
            this.noLines = false;
            this.particles.forEach(particle => {
                particle.velocity = new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed);
                particle.active = false;
            });
        }
        else {
            for (let i = 0; i < this.stateArray[this.currentState][0].length; i++) {
                if (this.particles[i] == undefined) break;

                this.particles[i].targetPos = this.stateArray[this.currentState][0][i];

                this.particles[i].active = true;
            }
            let state = this.currentState
            setTimeout(() => {
                for (let i = 0; i < this.stateArray[state][1].length; i++) {
                    
                    let indicies = this.stateArray[state][1][i]

                    if (this.particles[indicies[0]] == undefined || this.particles[indicies[1]] == undefined || this.particles[indicies[2]] == undefined) continue;
  
                    this.triangleManager.makeTriangleFromParticles(this.particles[indicies[0]], this.particles[indicies[1]], this.particles[indicies[2]])                
                
                }
            }, 800, this, state)
            //for each indicie in the mesh
           
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
    constructor(p1, p2, p3, spot1, spot2, spot3, index) {
        this.p1 = p1;
        this.p2 = p2;
        this.p3 = p3;
        this.spot1 = spot1;
        this.spot2 = spot2;
        this.spot3 = spot3;
        this.index = index
    } 
}

class TriangleMeshManager {
    constructor(maxTris) {
        this.maxTris = maxTris;

        this.linePositions = new Float32Array(this.maxTris * 3 * 3);
        this.indices = new Uint16Array(this.maxTris * 3 * 2);

        this.numTris = 0;
        this.openSpots = [];
        this.fillSpot = 0;
        this.Triangles = [];
        this.openTriangleSpots = [];
    }
    clearAll() {
        console.log(this.linePositions);
        for (let i = 0; i < this.linePositions.length; i++) {
            this.linePositions[i] = 0;
        }
        console.log(this.linePositions);

    }

    updateAllTriangles() {
        for (let i = 0; i < this.Triangles.length; i++) {
            if (this.Triangles[i] == null) continue;
            let tri = this.Triangles[i];
            let toFarFromOrigin = tri.p1.position.distanceToSquared(tri.p2.position) > maxTrisLenght || tri.p1.position.distanceToSquared(tri.p3.position) > maxTrisLenght
            let sameChunk = 
            tri.p1.xChunkOld == tri.p2.xChunkOld && tri.p2.xChunkOld == tri.p3.xChunkOld && 
            tri.p1.yChunkOld == tri.p2.yChunkOld && tri.p2.yChunkOld == tri.p3.yChunkOld &&
            tri.p1.zChunkOld == tri.p2.zChunkOld && tri.p2.zChunkOld == tri.p3.zChunkOld

            if (toFarFromOrigin || !sameChunk) {

                tri.p1.activeTriangles.splice(tri.spot1)
                tri.p2.activeTriangles.splice(tri.spot2)
                tri.p3.activeTriangles.splice(tri.spot3)
                
                this.removeTriangle(tri.index);
                delete this.Triangles[i];
                this.openTriangleSpots.push(i)
                return;
            }
            this.updateTriangle(tri.p1.position, tri.p2.position, tri.p3.position, tri.index)
        }
    }

    makeTriangleFromParticles(p1,p2,p3) {
        let triIndex = this.addTriangle(p1.position, p2.position, p3.position);
        p1.activeTriangles.push(triIndex);
        let spot1 = p1.activeTriangles.length - 1;
        p2.activeTriangles.push(triIndex);
        let spot2 = p1.activeTriangles.length - 1;
        p3.activeTriangles.push(triIndex);
        let spot3 = p1.activeTriangles.length - 1;
        if (this.openTriangleSpots.length > 0) {
            this.Triangles[this.openTriangleSpots.pop()] = new triangleData(p1, p2, p3, spot1, spot2, spot3, triIndex)
        }
        else {
            this.Triangles.push(new triangleData(p1, p2, p3, spot1, spot2, spot3, triIndex));
        }
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

        this.linePositions[index * 3 * 3 + 0] = vec1.x;
        this.linePositions[index * 3 * 3 + 1] = vec1.y;
        this.linePositions[index * 3 * 3 + 2] = vec1.z;

        this.linePositions[index * 3 * 3 + 3] = vec2.x;
        this.linePositions[index * 3 * 3 + 4] = vec2.y;
        this.linePositions[index * 3 * 3 + 5] = vec2.z;

        this.linePositions[index * 3 * 3 + 6] = vec3.x;
        this.linePositions[index * 3 * 3 + 7] = vec3.y;
        this.linePositions[index * 3 * 3 + 8] = vec3.z;
        
        if (!usedOpenSpot) this.fillSpot += 1;
        
        this.numLines++;   

        return (index);
    }
    updateTriangle(vec1, vec2, vec3, index) {
        
        if (index >= this.fillSpot) console.log(this.fillSpot);

        this.linePositions[index * 3 * 3 + 0] = vec1.x;
        this.linePositions[index * 3 * 3 + 1] = vec1.y;
        this.linePositions[index * 3 * 3 + 2] = vec1.z;

        this.linePositions[index * 3 * 3 + 3] = vec2.x;
        this.linePositions[index * 3 * 3 + 4] = vec2.y;
        this.linePositions[index * 3 * 3 + 5] = vec2.z;

        this.linePositions[index * 3 * 3 + 6] = vec3.x;
        this.linePositions[index * 3 * 3 + 7] = vec3.y;
        this.linePositions[index * 3 * 3 + 8] = vec3.z;
    }  
    removeTriangle(index) {
        console.log("index", index)
        console.log("fill", this.fillSpot)
        if (index < 0 || index >= this.fillSpot) { console.log("fefe"); return; }
        
        this.linePositions[index * 3 * 3 + 0] = 0;
        this.linePositions[index * 3 * 3 + 1] = 0;
        this.linePositions[index * 3 * 3 + 2] = 0;

        this.linePositions[index * 3 * 3 + 3] = 0;
        this.linePositions[index * 3 * 3 + 4] = 0;
        this.linePositions[index * 3 * 3 + 5] = 0;
       
        //vert 1
        this.linePositions[index * 3 * 3 + 6] = 0;
        this.linePositions[index * 3 * 3 + 7] = 0;
        this.linePositions[index * 3 * 3 + 8] = 0;
        
        this.numLines--;
        this.openSpots.push(index)
    } 
    makeIndicies() {
        for (let index = 0; index < this.maxTris; index++) {
            this.indices[index * 3 * 2 + 0] = [index * 3 + 0];
            this.indices[index * 3 * 2 + 1] = [index * 3 + 1];
            this.indices[index * 3 * 2 + 2] = [index * 3 + 2];
    
            this.indices[index * 3 * 2 + 3] = [index * 3 + 0];
            this.indices[index * 3 * 2 + 4] = [index * 3 + 2];
            this.indices[index * 3 * 2 + 5] = [index * 3 + 1];
        }
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
        let lineManager = new LineMeshManager(linesNum);

        let triangleManager = new TriangleMeshManager(trisNum);
        triangleManager.makeIndicies();

        let stateManager = new StateManager(particles, lineManager, triangleManager, triangleMeshBuffer);
        stateManager.loadStates();
/*

        vec1 = new THREE.Vector3(-50,0,0);
        vec2 = new THREE.Vector3(-10,0,0);
        vec3 = new THREE.Vector3(-10,-10,0);
        triangleManager.addTriangle(vec1, vec2, vec3)

        vec1 = new THREE.Vector3(45,0,0);
        vec2 = new THREE.Vector3(90,0,0);
        vec3 = new THREE.Vector3(90,180,0);
        triangleManager.addTriangle(vec1, vec2, vec3)


        console.log(triangleManager.linePositions)
        console.log(triangleManager.indices)*/
        return {particles, octree, stateManager, lineManager, triangleManager}; 
    }, [])

    useFrame(({clock}) => {

        //triangleManager.updateTriangle(particles[0].position, particles[1].position, particles[2].position, 0)
        if (!stateManager.noLines) triangleManager.updateAllTriangles();
        //console.log(triangleManager.linePositions);
        for (let i = 0; i < particles.length; i++) {
            if (particles[i].active) {
                particles[i].goToWanted()
            }

            particles[i].SetPosition(octree, particles[i].position.add(particles[i].velocity), viewport);

            if (particles[i].lineCenter && !stateManager.noLines) {
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

                let closestDistances = [maxTrisLenght,maxTrisLenght]
                let closestParticles = [null, null]
                for (let child = 0; child < particles[i].boundParticles.length; child++) {
                    
                    let childParticle = particles[i].boundParticles[child];
                    
                    let sameChunk = (particles[i].xChunkOld == childParticle.xChunkOld && particles[i].yChunkOld == childParticle.yChunkOld && particles[i].zChunkOld == childParticle.zChunkOld )
                    //update if they are in the same chunk
                    if (sameChunk) {
                        lineManager.updateLine(particles[i].position, childParticle.position, lineSize, particles[i].lineConnectionsIndex[child])
                        
                        if (particles[i].activeTriangles.length == 0) {
                            let distance = particles[i].position.distanceToSquared(childParticle.position);
                            for (let l = 0; l < 2; l++) {
                                if (distance < closestDistances[l]) {
                                    closestDistances[l] = distance;
                                    closestParticles[l] = childParticle;
                                    break;
                                }
                            }
                        }
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

                if (closestParticles[1] != null) triangleManager.makeTriangleFromParticles(particles[i], closestParticles[0], closestParticles[1])
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
        triangleMeshBuffer.current.index.needsUpdate = true;
        //test.current.attributes.position.needsUpdate = true;
        lineMeshBuffer.current.attributes.position.needsUpdate = true;
        lineMeshBuffer.current.attributes.color.needsUpdate = true;
        pointManager.current.instanceMatrix.needsUpdate = true
        //pointManager.current.instanceColor.needsUpdate = true
    })

    const colors = new Float32Array(trisNum * 3 * 4)
    for (let i = 0; i < colors.length; i += 4) {
        colors[i + 0] = trisColor.r;
        colors[i + 1] = trisColor.g;
        colors[i + 2] = trisColor.b;
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
