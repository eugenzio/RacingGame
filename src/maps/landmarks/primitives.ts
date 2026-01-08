import * as THREE from 'three';

// Helper to create simple geometry-based landmarks

export function createSeoulTower(color: number = 0xcccccc): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color });
    
    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 20, 8), mat);
    base.position.y = 10;
    group.add(base);

    // Tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 40, 8), mat);
    tower.position.y = 40;
    group.add(tower);

    // Pod
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 16), new THREE.MeshStandardMaterial({ color: 0x3366ff, emissive: 0x112255 }));
    pod.position.y = 50;
    group.add(pod);

    // Antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 30), mat);
    ant.position.y = 67;
    group.add(ant);

    return group;
}

export function createTokyoTower(color: number = 0xff3300): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, wireframe: false }); // Lattice implied by shape
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    // 3 Tiers
    const bot = new THREE.Mesh(new THREE.BoxGeometry(12, 20, 12), mat);
    bot.position.y = 10;
    // Taper effect manually? simple boxes for performance
    bot.scale.set(1.5, 1, 1.5);
    group.add(bot);

    const mid = new THREE.Mesh(new THREE.BoxGeometry(8, 20, 8), whiteMat);
    mid.position.y = 30;
    group.add(mid);

    const top = new THREE.Mesh(new THREE.BoxGeometry(4, 20, 4), mat);
    top.position.y = 50;
    group.add(top);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1, 20), whiteMat);
    spire.position.y = 70;
    group.add(spire);

    return group;
}

export function createEmpireState(color: number = 0x999999): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color });

    // Steps
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(15, 40, 10), mat);
    s1.position.y = 20;
    group.add(s1);

    const s2 = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 8), mat);
    s2.position.y = 50;
    group.add(s2);

    const s3 = new THREE.Mesh(new THREE.BoxGeometry(5, 10, 5), mat);
    s3.position.y = 65;
    group.add(s3);

    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 15), mat);
    needle.position.y = 77.5;
    group.add(needle);

    return group;
}

export function scatterBuildings(scene: THREE.Scene, count: number, center: THREE.Vector3, radius: number, range: number, color: number) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        // Random pos in a ring
        const r = radius + Math.random() * range;
        const theta = Math.random() * Math.PI * 2;
        const x = center.x + Math.cos(theta) * r;
        const z = center.z + Math.sin(theta) * r;
        
        const h = 5 + Math.random() * 20; // Height
        const w = 2 + Math.random() * 5;  // Width

        dummy.position.set(x, h/2, z);
        dummy.scale.set(w, h, w);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}
