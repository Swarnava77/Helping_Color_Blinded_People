"use strict"

let model
let inferring = false
let inferenceInterval = parseInt(localStorage.getItem("inferenceInterval")) || 500
const degToRad = x => x * Math.PI / 180

const classColours = {
    // defaults
    person: "ffff00", // yellow
    vehicles: "ff0000", // red
    animals: "00ffff", // aqua
    foods: "00ff00", // green
    things: "800080", // purle
    furniture: "0000ff" // blue
}

const activeClasses = {
    person: true,
    vehicles: true,
    animals: true,
    foods: true,
    things: true,
    furniture: true
}

const classCategories = {
    animals: ["bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"],
    vehicles: ["car", "bicycle", "motorbike", "aeroplane", "bus", "train", "truck", "boat"],
    foods: ["banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake"],
    things: ["bench", "backpack", "umbrella", "handbag", "suitcase", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl",
    "tvmonitor", "laptop", "mouse", "remote", "keyboard", "cell phone", "toothbrush"],
    furniture: ["chair", "sofa", "bed", "diningtable", "toilet", "microwave", "oven", "toaster", "sink", "refrigerator"]
}


window.addEventListener("load", async () => {

    // YOLO
    inferenceIntervalInput.value = inferenceInterval

    const inferenceCanvas = document.createElement("canvas")
    inferenceCanvas.height = 416
    inferenceCanvas.width = 416
    const inferenceContext = inferenceCanvas.getContext("2d")

    // Renderer and VR stuff
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)
    renderer.domElement.style.backgroundColor = "black"

    let effect = new THREE.VREffect(renderer)
    effect.separation = 0
    effect.setSize(window.innerWidth, window.innerHeight)

    let vrDisplay

    if (navigator.getVRDisplays) {
        navigator.getVRDisplays().then(displays => displays.length && (vrDisplay = displays[0]))
    }

    // Button to enable VR mode
    enterVRButton.addEventListener("click", () => {
        const controls = document.getElementById("controls")

        if (enterVRButton.classList.contains("small")) {
            closeVR()
            enterVRButton.classList.remove("small")
            controls.classList.remove("hidden")
        } else {
            if (navigator.userAgent.includes("Mobile VR")) {
                vrDisplay.requestPresent([{ source: renderer.domElement }])
            } else {
                effect = new THREE.StereoEffect(renderer)
                effect.separation = 0
                effect.setSize(window.innerWidth, window.innerHeight)
            }

            // Shrink VR button
            enterVRButton.classList.add("small")

            // Hide controls
            controls.classList.add("hidden")
        }
    })

    const closeVR = () => {
        effect = new THREE.VREffect(renderer)
        effect.separation = 0
        effect.setSize(window.innerWidth, window.innerHeight)
    }

    // Scenes and camera
    const fov = 70
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 1000)
    scene.add(camera)

    // Box object
    let texture
    let fireTexture
    let noiseTexture
    let boxMaterial
    let box

    // Detection box/canvas
    window.detectionCanvas = document.createElement("canvas")
    let detectionContext
    let detectionTexture
    let detectionMaterial
    let detectionBox

    const makeBoxObject = () => {
        window.video = document.createElement("video")
        video.autoplay = true
        video.width = window.innerWidth / 2
        video.height = window.innerHeight / 2
        getVideoFeed()

        detectionCanvas.width = video.width
        detectionCanvas.height = video.height
        window.detectionContext = detectionContext = detectionCanvas.getContext("2d")
        detectionContext.strokeWidth = 25
        detectionContext.font = "20px Arial"
        detectionContext.textAlign = "center"

        const boxWidth = video.width
        const boxHeight = video.height

        const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, 1)
        texture = new THREE.Texture(video)
        texture.minFilter = THREE.NearestFilter

        const detectionGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, 1)
        detectionTexture = new THREE.Texture(detectionCanvas)
        detectionTexture.minFilter = THREE.NearestFilter

        fireTexture = new THREE.Texture(fire)
        fireTexture.minFilter = THREE.NearestFilter
        fireTexture.wrapS = THREE.RepeatWrapping
        fireTexture.wrapT = THREE.RepeatWrapping

        noiseTexture = new THREE.Texture(noise)
        noiseTexture.minFilter = THREE.NearestFilter
        noiseTexture.wrapS = THREE.RepeatWrapping
        noiseTexture.wrapT = THREE.RepeatWrapping


        boxMaterial = new THREE.ShaderMaterial({
            uniforms: {
                texture: {
                    type: "t",
                    value: texture
                },
                fireTex: {
                    type: "t",
                    value: fireTexture
                },
                noiseTex: {
                    type: "t",
                    value: noiseTexture
                },
                width: {
                    type: "f",
                    value: video.width
                },
                height: {
                    type: "f",
                    value: video.height
                },
                radius: {
                    type: "f",
                    value: 0.4
                },
                intensity: {
                    type: "f",
                    value: 1.0
                },
                edgeR: {
                    type: "f",
                    value: 1.0
                },
                edgeG: {
                    type: "f",
                    value: 1.0
                },
                edgeB: {
                    type: "f",
                    value: 1.0
                },
                surfaceR: {
                    type: "f",
                    value: 0.0
                },
                surfaceG: {
                    type: "f",
                    value: 0.0
                },
                surfaceB: {
                    type: "f",
                    value: 0.0
                },
                lightCols: {
                    type: "t",
                    value: [...new Array(10)].map(v => Math.floor(Math.random()*10*video.width/60))
                },
                lightColsEnds: {
                    type: "t",
                    value: [...new Array(10)].map(v => Math.floor(Math.random()*10*video.height/50))
                },
                fireTimer: {
                    type: "f",
                    value: 0.0
                }
            },
            vertexShader: vertexShaderSource.text,
            fragmentShader: Filters.compileShader("sobel3x3")
        })
        box = new THREE.Mesh(boxGeometry, boxMaterial)
        scene.add(box)

        detectionMaterial = new THREE.MeshBasicMaterial({map: detectionTexture, transparent: true})
        detectionBox = new THREE.Mesh(detectionGeometry, detectionMaterial)
        scene.add(detectionBox)

        camera.position.z = 0.5 * boxWidth * Math.atan(degToRad(90 - fov / 2)) + 100
    }

    let getVideoFeedAttempts = 0

    const getVideoFeed = () => {

        let errMessage = "There was an error accessing the camera."

        if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
            errMessage += " iOS might still have no support for camera API."
        }

        if (!location.protocol.startsWith("https")) {
            errMessage += " Please make sure you are using https."
        }

        try {

            if ("mozGetUserMedia" in navigator) {
                navigator.mozGetUserMedia(
                    {video: { facingMode: "environment" }},
                    stream => {
                        video.srcObject = stream
                    },
                    err => {
                        console.log(err)
                        alert(errMessage)
                    }
                )
            } else {
                const mediaDevicesSupport = navigator.mediaDevices && navigator.mediaDevices.getUserMedia

                if (mediaDevicesSupport) {
                    navigator.mediaDevices
                        .getUserMedia({ video: { facingMode: "environment" } })
                        .then(stream => {
                            video.srcObject = stream
                        })
                        .catch(err => {
                            console.log(err)
                            getVideoFeedAttempts++

                            // Rarely, getting the camera fails. Re-attempting usually works, on refresh.
                            if (getVideoFeedAttempts<3) {
                                getVideoFeed()
                            } else {
                                alert(errMessage)
                            }
                        })
                } else {
                    const getUserMedia =
                        navigator.getUserMedia ||
                        navigator.webkitGetUserMedia ||
                        navigator.mozGetUserMedia ||
                        navigator.msGetUserMedia

                    if (getUserMedia) {
                        getUserMedia(
                            { video: { facingMode: "environment" } },
                            stream => {
                                video.srcObject = stream
                            },
                            err => {
                                console.log(err)
                                alert(errMessage)
                            }
                        )
                    } else {
                        alert("Camera not available")
                    }
                }
            }

        } catch (e) {
            alert(errMessage)
        }
    }

    // Render loop
    const render = () => {
        requestAnimationFrame(render)

        if (video.currentTime) {
            texture.needsUpdate = true
            detectionTexture.needsUpdate = true
        }

        if (Filters.fire) {
            fireTexture.needsUpdate = true
            noiseTexture.needsUpdate = true
        }

        if (Filters.matrix) {
            boxMaterial.uniforms.lightColsEnds.value = boxMaterial.uniforms.lightColsEnds.value.map(v => v -= Math.random()/2)
        }

        effect.render(scene, camera)

        // YOLO
        const drawRect = (left, right, top, bottom, className, classProb, category) => {

            if (!activeClasses[category]) return

            left = left / 416 * detectionCanvas.width
            right = right / 416 * detectionCanvas.width
            top = top / 416 * detectionCanvas.height
            bottom = bottom / 416 * detectionCanvas.height

            const text = `${className} [${parseInt(classProb*100)}%]`
            const textSize = detectionContext.measureText(text)
            const textLeft = left+(right-left)/2

            detectionContext.strokeStyle = `#${classColours[category]}`
            detectionContext.fillStyle = "white"
            detectionContext.fillRect(textLeft-textSize.width/2, top, textSize.width, 20)
            detectionContext.fillStyle = "black"

            detectionContext.beginPath()
            detectionContext.fillText(text, textLeft, top+15)
            detectionContext.rect(left, top, right-left, bottom-top)
            detectionContext.stroke()
        }

        if (!inferring) {

            if (window.aiTurnedOn) {
                console.log("inferring...")

                inferring = true

                setTimeout(() => {

                    inferenceContext.drawImage(video, 0, 0, 416, 416)

                    const inputImage = tf.tidy(() => {
                        const scalar = tf.scalar(255)
                        const input = cropImage(tf.fromPixels(inferenceCanvas)).expandDims(0).toFloat().div(scalar)
                        return input
                    })
                    detectionContext.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height)

                    yolo(inputImage, model).then(boxes => {
                        boxes.forEach(({left, right, top, bottom, className, classProb}) => {

                            if (className=="person") {
                                drawRect(left, right, top, bottom, "Person", classProb, "person")
                            } else {

                                const classes = Object.keys(classCategories)

                                for (let c=0; c<classes.length; c++) {
                                    if (classCategories[classes[c]].includes(className)) {
                                        drawRect(left, right, top, bottom, capitalize(className), classProb, classes[c])
                                        break
                                    }
                                }
                            }
                        })

                        inferring = false
                    })
                }, inferenceInterval)
            } else {
                detectionContext.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height)
            }
        }
    }

    makeBoxObject()
    render()

    // Request fullscreen when tapped
    if (!window.location.href.includes("localhost")) {
        renderer.domElement.addEventListener("click", () => {
            document.fullscreenEnabled && renderer.domElement.requestFullScreen() ||
            document.webkitFullscreenEnabled && renderer.domElement.webkitRequestFullScreen() ||
            document.mozFullScreenEnabled && renderer.domElement.mozRequestFullScreen() ||
            document.msFullScreenEnabled && renderer.domElement.msRequestFullScreen()
        })
    }

    // Resizing
    window.addEventListener("resize", () => {
        effect.setSize(window.innerWidth, window.innerHeight)
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        scene.remove(box)
        video.pause()
        makeBoxObject()

        setShader(document.querySelector(".filter-button:disabled").dataset.filter)
        setIntensity((parseFloat(document.getElementById("intensity-slider").value)||0.01) / 100)
        setRadius(parseFloat(document.getElementById("radius-slider").value) / 100)
    })

    window.setShader = shader => {
        Filters.shader = shader
        boxMaterial.fragmentShader = Filters.compileShader(shader)
        boxMaterial.needsUpdate = true
    }

    window.setRadius = val => {
        boxMaterial.uniforms.radius.value = val
    }

    window.setIntensity = val => {
        boxMaterial.uniforms.intensity.value = 1 - val
    }

    window.toggleInverted = () => {
        Filters.isInverted = !Filters.isInverted
        boxMaterial.fragmentShader = Filters.compileShader(Filters.shader)
        boxMaterial.needsUpdate = true
    }

    window.setEdgeColour = ({r=0, g=0, b=0}) => {
        boxMaterial.uniforms.edgeR.value = r / 255
        boxMaterial.uniforms.edgeG.value = g / 255
        boxMaterial.uniforms.edgeB.value = b / 255
    }

    // For reverting to, when toggling back to colour, from background
    const surfaceCache = {r: 0, g: 0, b: 0}

    window.setSurfaceColour = ({r=0, g=0, b=0}) => {
        boxMaterial.uniforms.surfaceR.value = surfaceCache.r = r / 255
        boxMaterial.uniforms.surfaceG.value = surfaceCache.g = g / 255
        boxMaterial.uniforms.surfaceB.value = surfaceCache.b = b / 255
    }

    window.toggleReducedColours = () => {
        Filters.hasReducedColours = !Filters.hasReducedColours
        boxMaterial.fragmentShader = Filters.compileShader(Filters.shader)
        boxMaterial.needsUpdate = true
    }

    window.toggleBackground = isBackground => {

        Filters.hasBackground = !!isBackground

        if (Filters.hasBackground) {
            boxMaterial.uniforms.surfaceR.value = 0
            boxMaterial.uniforms.surfaceG.value = 0
            boxMaterial.uniforms.surfaceB.value = 0
        } else {
            boxMaterial.uniforms.surfaceR.value = surfaceCache.r
            boxMaterial.uniforms.surfaceG.value = surfaceCache.g
            boxMaterial.uniforms.surfaceB.value = surfaceCache.b
        }

        boxMaterial.fragmentShader = Filters.compileShader(Filters.shader)
        boxMaterial.needsUpdate = true
    }

    window.updateColourBlindness = type => {
        Filters.colourBlindness = type.toLowerCase()
        boxMaterial.fragmentShader = Filters.compileShader(Filters.shader)
        boxMaterial.needsUpdate = true
    }

    window.toggleMatrix = () => {

        Filters.matrix = true

        clearInterval(Filters.matrixInterval)

        toggleBackground(false)
        setEdgeColour({r: 0, g: 255, b: 0})
        setIntensity(1)
        setRadius(1)

        boxMaterial.fragmentShader = Filters.compileShader("matrix")
        boxMaterial.needsUpdate = true

        Filters.matrixInterval = setInterval(() => {

            for (let i=0; i<boxMaterial.uniforms.lightColsEnds.value.length; i++) {
                if (boxMaterial.uniforms.lightColsEnds.value[i] < 0) {
                    boxMaterial.uniforms.lightCols.value[i] = Math.floor(Math.random()*10*video.width/50)
                    boxMaterial.uniforms.lightColsEnds.value[i] = video.height/5
                }
            }

        }, 100)
    }


    window.toggleFire = (off) => {

        if (off) {
            Filters.fire = false
            audioElem.pause()
            boxMaterial.uniforms.fireTimer.value = 10000000
            clearInterval(Filters.fireInterval)
            window.setShader(Filters.shader)
            return
        }

        if (Filters.fire) {
            return
        }


        Filters.fire = true
        Filters.fireTimer = 0
        clearInterval(Filters.matrixInterval)
        clearInterval(Filters.fireInterval)

        boxMaterial.uniforms.surfaceR.value = surfaceCache.r
        boxMaterial.uniforms.surfaceG.value = surfaceCache.g
        boxMaterial.uniforms.surfaceB.value = surfaceCache.b
        setEdgeColour({r: 255, g: 177, b: 0})
        setIntensity(1)
        setRadius(1)

        boxMaterial.fragmentShader = Filters.compileShader("fire")
        boxMaterial.needsUpdate = true

        Filters.fireInterval = setInterval(() => {
            Filters.fireTimer += 8
            boxMaterial.uniforms.fireTimer.value = (Filters.fireTimer % fire.height/2) / fire.height
        }, 2)

        // Audio
        if (Filters.fire) {
            // audioElem.currentTime = 47
            audioElem.play()
        }
    }

    initUI()
})

// Helper functions
function cropImage(img) {
    const size = Math.min(img.shape[0], img.shape[1])
    const centerHeight = img.shape[0] / 2
    const beginHeight = centerHeight - (size / 2)
    const centerWidth = img.shape[1] / 2
    const beginWidth = centerWidth - (size / 2)
    return img.slice([beginHeight, beginWidth, 0], [size, size, 3])
}

function capitalize (string) {
    return string.slice(0, 1).toUpperCase() + string.slice(1, string.length)
}

function loadScript (src) {
    return new Promise((resolve) => {
        fetch(src).then(r => r.text()).then(source => {
            const scriptElem = document.createElement("script")
            scriptElem.innerHTML = source
            document.head.appendChild(scriptElem)
            resolve()
        })
    })
}
"use strict"

class Filters {

    static get availableFilters () {
        return ["No edges", "Sobel 3x3", "Sobel 5x5", "Frei-Chen"]
    }

    static compileShader (name) {
        return `
            uniform sampler2D texture;
            uniform sampler2D fireTex;
            uniform sampler2D noiseTex;
            uniform float width;
            uniform float height;
            uniform float radius;
            uniform float intensity;
            uniform vec2 resolution;
            varying vec2 vUv;

            uniform float edgeR;
            uniform float edgeG;
            uniform float edgeB;

            uniform float surfaceR;
            uniform float surfaceG;
            uniform float surfaceB;

            uniform float fireTimer;
            uniform float lightCols[5];
            uniform float lightColsEnds[5];

            float rand(vec2 co){
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
            }

            void main() {

                float w = 1.0 / width;
                float h = 1.0 / height;

                vec4 pixel = texture2D(texture, vUv);

                if (sqrt( (0.5 - vUv[0])*(0.5 - vUv[0]) + (0.5 - vUv[1])*(0.5 - vUv[1]) ) < radius) {

                    ${this[name+"Body"]}

                    ${this.colourBlindness && this.colourBlindness != "none" ? this.colourBlindnessBody : ""}

                    gl_FragColor = newColour*(1.0-intensity) + pixel*intensity;

                    ${this.hasBackground ? this.addBackground : ""}

                    ${this.hasReducedColours ? this.reducedColoursBody : ""}

                    ${this.isInverted ? this.invertedBody : ""}

                } else {
                    gl_FragColor = vec4(pixel.rgb, 1.0);
                }

            }
        `
    }

    static get noedgesBody () {
        return `vec4 newColour = vec4(pixel.rgb, 1.0);`
    }

    static get invertedBody () {
        return `
            gl_FragColor.rgb = 1.0 - gl_FragColor.rgb;
        `
    }

    static get reducedColoursBody () {
        return `
            gl_FragColor.r = float(floor(gl_FragColor.r * 5.0 ) / 5.0);
            gl_FragColor.g = float(floor(gl_FragColor.g * 5.0 ) / 5.0);
            gl_FragColor.b = float(floor(gl_FragColor.b * 5.0 ) / 5.0);
        `
    }

    static get addBackground () {
        return `
            gl_FragColor.r += pixel.r * 0.9;
            gl_FragColor.g += pixel.g * 0.9;
            gl_FragColor.b += pixel.b * 0.9;
        `
    }

    /*
    1   0   -1
    2   0   -2
    1   0   -1
    */
    static get sobel3x3Body () {
        return `
            vec4 n[9];
            n[0] = texture2D(texture, vUv + vec2(0.0, 0.0) );
            n[1] = texture2D(texture, vUv + vec2(w, 0.0) );
            n[2] = texture2D(texture, vUv + vec2(2.0*w, 0.0) );
            n[3] = texture2D(texture, vUv + vec2(0.0*w, h) );
            n[4] = texture2D(texture, vUv + vec2(w, h) );
            n[5] = texture2D(texture, vUv + vec2(2.0*w, h) );
            n[6] = texture2D(texture, vUv + vec2(0.0, 2.0*h) );
            n[7] = texture2D(texture, vUv + vec2(w, 2.0*h) );
            n[8] = texture2D(texture, vUv + vec2(2.0*w, 2.0*h) );

            vec4 sobel_x = n[2] + (2.0*n[5]) + n[8] - (n[0] + (2.0*n[3]) + n[6]);
            vec4 sobel_y = n[0] + (2.0*n[1]) + n[2] - (n[6] + (2.0*n[7]) + n[8]);

            float avg_x = (sobel_x.r + sobel_x.g + sobel_x.b) / 3.0;
            float avg_y = (sobel_y.r + sobel_y.g + sobel_y.b) / 3.0;

            sobel_x.r = avg_x;
            sobel_x.g = avg_x;
            sobel_x.b = avg_x;
            sobel_y.r = avg_y;
            sobel_y.g = avg_y;
            sobel_y.b = avg_y;

            vec3 sobel = vec3(sqrt((sobel_x.rgb * sobel_x.rgb) + (sobel_y.rgb * sobel_y.rgb)));
            sobel.r = surfaceR * (1.0 - sobel.r) + sobel.r * edgeR;
            sobel.g = surfaceG * (1.0 - sobel.g) + sobel.g * edgeG;
            sobel.b = surfaceB * (1.0 - sobel.b) + sobel.b * edgeB;

            vec4 newColour = vec4( sobel, 1.0 );
        `
    }

    /*
    2   1   0   -1  -2
    3   2   0   -2  -3
    4   3   0   -3  -4
    3   2   0   -2  -3
    2   1   0   -1  -2
    */
    static get sobel5x5Body () {
        return `
            vec4 n[25];

            for (int i=-2; i<=2; i++) {
                for (int j=-2; j<=2; j++) {
                    n[(j+2)+(i+2)*5] = texture2D(texture, vUv + vec2(float(j)*w, float(i)*h) );
                }
            }

            vec4 sobel_x = 2.0*n[4] + 3.0*n[9] + 4.0*n[14] + 3.0*n[19] + 2.0*n[24] +
                           n[3] + 2.0*n[8] + 3.0*n[13] + 2.0*n[18] + n[23] -
                           (2.0*n[0] + 3.0*n[5] + 4.0*n[10] + 3.0*n[15] + 2.0*n[20] +
                           n[1] + 2.0*n[6] + 3.0*n[11] + 2.0*n[16] + n[21]);

            vec4 sobel_y = 2.0*n[0] + n[1] + n[3] + n[4] +
                           3.0*n[5] + 2.0*n[6] + 2.0*n[8] + 3.0*n[9] -
                           (3.0*n[15] + 2.0*n[16] + 2.0*n[18] + 3.0*n[19] +
                            2.0*n[20] + n[21] + n[23] + n[24]);

            float avg_x = (sobel_x.r + sobel_x.g + sobel_x.b) / 3.0 / 9.0;
            float avg_y = (sobel_y.r + sobel_y.g + sobel_y.b) / 3.0 / 9.0;

            sobel_x.r = avg_x;
            sobel_x.g = avg_x;
            sobel_x.b = avg_x;
            sobel_y.r = avg_y;
            sobel_y.g = avg_y;
            sobel_y.b = avg_y;

            vec3 sobel = vec3(sqrt((sobel_x.rgb * sobel_x.rgb) + (sobel_y.rgb * sobel_y.rgb)));
            sobel.r = surfaceR * (1.0 - sobel.r) + sobel.r * edgeR;
            sobel.g = surfaceG * (1.0 - sobel.g) + sobel.g * edgeG;
            sobel.b = surfaceB * (1.0 - sobel.b) + sobel.b * edgeB;

            vec4 newColour = vec4(sobel, 1.0 );
        `
    }

    static get freichenBody () {
        return `

            vec2 texel = vec2(1.0 / width, 1.0 / height);
            mat3 I;
            mat3 G[9];
            float cnv[9];

            G[0] = mat3( 0.3535533845424652, 0, -0.3535533845424652, 0.5, 0, -0.5, 0.3535533845424652, 0, -0.3535533845424652 );
            G[1] = mat3( 0.3535533845424652, 0.5, 0.3535533845424652, 0, 0, 0, -0.3535533845424652, -0.5, -0.3535533845424652 );
            G[2] = mat3( 0, 0.3535533845424652, -0.5, -0.3535533845424652, 0, 0.3535533845424652, 0.5, -0.3535533845424652, 0 );
            G[3] = mat3( 0.5, -0.3535533845424652, 0, -0.3535533845424652, 0, 0.3535533845424652, 0, 0.3535533845424652, -0.5 );
            G[4] = mat3( 0, -0.5, 0, 0.5, 0, 0.5, 0, -0.5, 0 );
            G[5] = mat3( -0.5, 0, 0.5, 0, 0, 0, 0.5, 0, -0.5 );
            G[6] = mat3( 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.6666666865348816, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204 );
            G[7] = mat3( -0.3333333432674408, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, 0.6666666865348816, 0.1666666716337204, -0.3333333432674408, 0.1666666716337204, -0.3333333432674408 );
            G[8] = mat3( 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408, 0.3333333432674408 );

            // Get intensity
            I[0][0] = length(texture2D(texture, vUv + texel * vec2(-1.0,-1.0) ).rgb);
            I[0][1] = length(texture2D(texture, vUv + texel * vec2(-1.0,0.0) ).rgb);
            I[0][2] = length(texture2D(texture, vUv + texel * vec2(-1.0,1.0) ).rgb);
            I[1][0] = length(texture2D(texture, vUv + texel * vec2(0.0,-1.0) ).rgb);
            I[1][1] = length(texture2D(texture, vUv + texel * vec2(0.0,0.0) ).rgb);
            I[1][2] = length(texture2D(texture, vUv + texel * vec2(0.0,1.0) ).rgb);
            I[2][0] = length(texture2D(texture, vUv + texel * vec2(1.0,-1.0) ).rgb);
            I[2][1] = length(texture2D(texture, vUv + texel * vec2(1.0,0.0) ).rgb);
            I[2][2] = length(texture2D(texture, vUv + texel * vec2(1.0,1.0) ).rgb);

            // Convolve
            cnv[0] = pow(dot(G[0][0], I[0]) + dot(G[0][1], I[1]) + dot(G[0][2], I[2]) , 2.0);
            cnv[1] = pow(dot(G[1][0], I[0]) + dot(G[1][1], I[1]) + dot(G[1][2], I[2]) , 2.0);
            cnv[2] = pow(dot(G[2][0], I[0]) + dot(G[2][1], I[1]) + dot(G[2][2], I[2]) , 2.0);
            cnv[3] = pow(dot(G[3][0], I[0]) + dot(G[3][1], I[1]) + dot(G[3][2], I[2]) , 2.0);
            cnv[4] = pow(dot(G[4][0], I[0]) + dot(G[4][1], I[1]) + dot(G[4][2], I[2]) , 2.0);
            cnv[5] = pow(dot(G[5][0], I[0]) + dot(G[5][1], I[1]) + dot(G[5][2], I[2]) , 2.0);
            cnv[6] = pow(dot(G[6][0], I[0]) + dot(G[6][1], I[1]) + dot(G[6][2], I[2]) , 2.0);
            cnv[7] = pow(dot(G[7][0], I[0]) + dot(G[7][1], I[1]) + dot(G[7][2], I[2]) , 2.0);
            cnv[8] = pow(dot(G[8][0], I[0]) + dot(G[8][1], I[1]) + dot(G[8][2], I[2]) , 2.0);

            float M = (cnv[0] + cnv[1]) + (cnv[2] + cnv[3]);
            float S = (cnv[4] + cnv[5]) + (cnv[6] + cnv[7]) + (cnv[8] + M);

            vec3 freiChen = vec3(sqrt(M/S)) * 2.0;
            freiChen.r = surfaceR * (1.0 - freiChen.r) + freiChen.r * edgeR;
            freiChen.g = surfaceG * (1.0 - freiChen.g) + freiChen.g * edgeG;
            freiChen.b = surfaceB * (1.0 - freiChen.b) + freiChen.b * edgeB;

            vec4 newColour = vec4(freiChen, 1.0 );
        `
    }


    static get matrixBody () {
        return `

            // ==============
            // Edge detection
            // ==============
            vec4 n[9];
            n[0] = texture2D(texture, vUv + vec2(0.0, 0.0) );
            n[1] = texture2D(texture, vUv + vec2(w, 0.0) );
            n[2] = texture2D(texture, vUv + vec2(2.0*w, 0.0) );
            n[3] = texture2D(texture, vUv + vec2(0.0*w, h) );
            n[4] = texture2D(texture, vUv + vec2(w, h) );
            n[5] = texture2D(texture, vUv + vec2(2.0*w, h) );
            n[6] = texture2D(texture, vUv + vec2(0.0, 2.0*h) );
            n[7] = texture2D(texture, vUv + vec2(w, 2.0*h) );
            n[8] = texture2D(texture, vUv + vec2(2.0*w, 2.0*h) );

            vec4 sobel_x = n[2] + (2.0*n[5]) + n[8] - (n[0] + (2.0*n[3]) + n[6]);
            vec4 sobel_y = n[0] + (2.0*n[1]) + n[2] - (n[6] + (2.0*n[7]) + n[8]);

            float avg_x = (sobel_x.r + sobel_x.g + sobel_x.b) / 12.0;
            float avg_y = (sobel_y.r + sobel_y.g + sobel_y.b) / 12.0;

            vec3 sobel = vec3(0, sqrt((avg_x * avg_x) + (avg_y * avg_y)) , 0);
            // ==============


            // ==============
            // Calculate highlighed columns values' intensities (looks better)
            // ==============
            float colIndex = floor(vUv.x*1000.0 / 10.0);
            float rowIndex = floor(vUv.y*1000.0 / 10.0);

            float colIntensity = 0.05;

            for (int i=0; i<25; i++) {
                if (lightCols[i] == colIndex) {
                    for (int j=0; j<20; j++) {
                        if (lightColsEnds[i] <= rowIndex) {
                            if (lightColsEnds[i] >= rowIndex-1.0 && lightColsEnds[i] <= rowIndex+1.0 ) {
                                colIntensity = 10.05;
                            } else {
                                colIntensity = 1.2 * min(max(lightColsEnds[i], 0.0) / rowIndex, 0.5) + 0.05;
                            }
                        }
                    }
                }
            }
            // ==============

            // ==============
            // Render the characters
            // ==============
            int modX = int((mod(vUv.x*1000.0, 10.0)*10.0)/10.0);
            int modY = int((mod( (vUv.y+colIndex*rand(vec2(colIndex, colIndex))) * 1000.0, 10.0)*10.0)/10.0);

            float x = floor(vUv.x*1000.0 / 10.0);
            float y = floor(vUv.y*1000.0 / 10.0);

            vec4 texRand = texture2D(texture, vec2(x, y));
            int charSelected = int(rand(vec2(x * texRand.r, y * texRand.r)) *2.0);

            float val = 0.0;

            if (charSelected==0) {
                // Draw '0'
                if ((modY==1 || modY==8) && (modX>=3 && modX<=6) ||
                    (modY>=2 && modY<=7) && (modX==2 || modX==3 || modX==6 || modX==7)) {
                    val = 1.0;
                }
            } else {
                // Draw '1'
                if ((modY==7 || modY==6) && modX==4 ||
                    (modX==5 || modX==6) && modY>0 && modY<9 ||
                    (modY==2 || modY==1) && modX>=4 && modX<=7) {
                    val = 1.0;
                }
            }

            sobel.g += val * (sobel.g + colIntensity);
            sobel.r = 0.3 * val * (sobel.g + colIntensity);
            sobel.b = sobel.r;

            // ==============

            vec4 newColour = vec4( sobel, 1.0 );
        `
    }

    static get fireBody () {
        return `

            // Get the pixel below by this amount
            const int amount = 15;
            vec4 firePixel = vec4(0.0, 0.0, 0.0, 1.0);

            vec4 distort = texture2D(fireTex, vec2(vUv.x*4.0, (vUv.y-fireTimer/2.0)*4.0));
            vec4 noise = texture2D(noiseTex, vec2(vUv.x*4.0, (vUv.y-fireTimer)*4.0));

            // Go down a few pixels and find if there is a line within ^^ amount of pixels
            for (int r=0; r<amount; r++) {
                vec4 n[9];
                float fr = float(r) * h;
                n[0] = texture2D(texture, vUv + vec2(0.0, 0.0 - fr) );
                n[1] = texture2D(texture, vUv + vec2(w, 0.0 - fr) );
                n[2] = texture2D(texture, vUv + vec2(2.0*w, 0.0 - fr) );
                n[3] = texture2D(texture, vUv + vec2(0.0*w, h - fr) );
                n[4] = texture2D(texture, vUv + vec2(w, h - fr) );
                n[5] = texture2D(texture, vUv + vec2(2.0*w, h - fr) );
                n[6] = texture2D(texture, vUv + vec2(0.0, 2.0*h - fr) );
                n[7] = texture2D(texture, vUv + vec2(w, 2.0*h - fr) );
                n[8] = texture2D(texture, vUv + vec2(2.0*w, 2.0*h - fr) );

                vec4 sobel_x = n[2] + (2.0*n[5]) + n[8] - (n[0] + (2.0*n[3]) + n[6]);
                vec4 sobel_y = n[0] + (2.0*n[1]) + n[2] - (n[6] + (2.0*n[7]) + n[8]);

                float avg_x = (sobel_x.r + sobel_x.g + sobel_x.b) / 3.0;
                float avg_y = (sobel_y.r + sobel_y.g + sobel_y.b) / 3.0;
                float sobel = sqrt(avg_x*avg_x) + sqrt(avg_y*avg_y) * noise.b;


                if (sobel > 0.5) {
                    firePixel.r = (1.0 - float(r) / float(amount)) * distort.r * sobel;
                    firePixel.g = firePixel.r / 2.0;

                    if (r<amount/2) {
                        firePixel.g += (1.0 - float(r) / float(amount/2)) * distort.r * noise.b / 8.0;
                        firePixel.r += (1.0 - float(r) / float(amount/2)) * distort.r * noise.b / 8.0;
                    }

                    if (r<2) {
                        firePixel.r = firePixel.r * 1.1;
                        firePixel.g = firePixel.g * 1.3;
                    }

                    break;
                }
            }

            vec4 newColour = pixel / 3.0;
            newColour.r += firePixel.r;
            newColour.g += firePixel.g;
        `
    }

    static get colourBlindnessBody () {

        // http://web.archive.org/web/20081014161121/http://www.colorjack.com/labs/colormatrix/
        const effects = {
            protanopia: [0.56667, 0.43333, 0,   0.55833, 0.44167, 0,   0, 0.24167, 0.75833],
            protanomaly: [0.81667, 0.18333, 0,  0.33333, 0.66667, 0,  0, 0.125, 0.875],
            deuteranopia: [0.625, 0.375, 0,   0.70, 0.30, 0,  0, 0.30, 0.70],
            deuteranomaly: [0.80, 0.20, 0,   0.25833, 0.74167, 0,  0, 0.14167, 0.85833],
            tritanopia: [0.95, 0.05, 0,   0, 0.43333, 0.56667,   0, 0.475, 0.525],
            tritanomaly: [0.96667, 0.03333, 0,   0, 0.73333, 0.26667,   0, 0.18333, 0.81667],
            achromatopsia: [0.299, 0.587, 0.114,   0.299, 0.587, 0.114,   0.299, 0.587, 0.114],
            achromatomaly: [0.618, 0.32, 0.062,   0.163, 0.775, 0.062,   0.163, 0.320, 0.516]
        }
        const M = effects[this.colourBlindness]

        return `
            newColour.r = newColour.r * ${M[0].toFixed(5)} + newColour.g * ${M[1].toFixed(5)} + newColour.b * ${M[2].toFixed(5)};
            newColour.g = newColour.r * ${M[3].toFixed(5)} + newColour.g * ${M[4].toFixed(5)} + newColour.b * ${M[5].toFixed(5)};
            newColour.b = newColour.r * ${M[6].toFixed(5)} + newColour.g * ${M[7].toFixed(5)} + newColour.b * ${M[8].toFixed(5)};
        `
    }
}
"use strict"

const initUI = () => {

    Filters.colourBlindness = "none"
    const filters = Filters.availableFilters
    const initialFilter = window.localStorage.getItem("filter") || "sobel3x3"

    window.setShader(initialFilter)

    const controlsRoot = document.getElementById("controls")
    const filtersRoot = controlsRoot.getElementsByClassName("filters")[0]
    const slidersRoot = controlsRoot.getElementsByClassName("sliders")[0]

    // Create filter buttons
    const filterButtons = filters.map((filter) => {
        const button = document.createElement("button")
        button.dataset.filter = filter.toLowerCase().replace(/\s|\-/g, "")
        button.innerText = filter
        button.classList.add("filter-button")

        if (button.dataset.filter === initialFilter) button.disabled = true

        filtersRoot.appendChild(button)
        return button
    }, [])

    // Radius slider
    const radiusSlider = document.getElementById("radius-slider")
    const radiusValue = document.getElementById("radius-value")
    radiusSlider.value = parseInt(window.localStorage.getItem("radius")) || 50

    // Intensity slider
    const intensitySlider = document.getElementById("intensity-slider")
    const intensityValue = document.getElementById("intensity-value")
    intensitySlider.value = parseInt(window.localStorage.getItem("intensity")) || 100

    // Events
    document.addEventListener("click", ({ target }) => {
        if (target.dataset.filter) {
            window.setShader(target.dataset.filter)
            filterButtons.forEach(button => button.disabled = false)
            target.disabled = true
            window.localStorage.setItem("filter", target.dataset.filter)
        }
    })

    const updateRadius = ({ target }) => {
        window.setRadius(target.value / 100)
        radiusValue.innerText = `${target.value}%`
        window.localStorage.setItem("radius", target.value)
    }
    updateRadius({target: radiusSlider})

    radiusSlider.addEventListener("change", updateRadius)
    radiusSlider.addEventListener("mousemove", updateRadius)

    const updateIntensity = ({ target }) => {
        window.setIntensity(target.value === "0" ? 0.01 : target.value / 100)
        intensityValue.innerText = `${target.value}%`
        window.localStorage.setItem("intensity", target.value)
    }
    updateIntensity({target: intensitySlider})

    intensitySlider.addEventListener("mousemove", updateIntensity)
    intensitySlider.addEventListener("change", updateIntensity)

    const controlMenuToggle = document.querySelector(".toggle")
    controlMenuToggle.addEventListener("click", () => controlsRoot.classList.toggle("open"))

    invertedCheckbox.addEventListener("click", () => toggleInverted())
    reducedColoursCheckbox.addEventListener("click", () => toggleReducedColours())
    surfaceCheckbox.addEventListener("click", () => toggleBackground(!Filters.hasBackground))

    const edgePicker = document.getElementById("edge-picker")
    const surfacePicker = document.getElementById("surface-picker")

    colourBlindness.addEventListener("change", () => updateColourBlindness(colourBlindness.value))

    window.updateColour = (type, jscolor) => {
        const rgb = {
            r: Math.floor(jscolor.rgb[0]),
            g: Math.floor(jscolor.rgb[1]),
            b: Math.floor(jscolor.rgb[2])
        }

        type === 'edge' ? window.setEdgeColour(rgb) : window.setSurfaceColour(rgb)

        if (document.querySelector("button[data-filter=sobel3x3]").disabled && rgb.r==0 && rgb.g==255 && rgb.b==0
            && surfaceCheckbox.checked && !reducedColoursCheckbox.checked && !invertedCheckbox.checked) {
            toggleMatrix()
        }

        if (document.querySelector("button[data-filter=sobel3x3]").disabled && rgb.r==255 && rgb.g==0 && rgb.b==0
            && surfaceCheckbox.checked && !reducedColoursCheckbox.checked && !invertedCheckbox.checked) {

            if (!Filters.fire) {
                toggleFire()
            }
        } else {
            if (Filters.fire) {
                window.toggleFire(true)
            }
        }
    }

    if (location.hash=="#matrix") {
        toggleMatrix()
    }

    if (location.hash=="#fire") {
        toggleFire()
    }

    // Fire shader
    const audioSrc = document.createElement("source")
    audioSrc.src = "fire.mp3"
    audioElem.appendChild(audioSrc)

    // YOLO
    let loadedAI = false
    const aiCheckbox = document.getElementById("ai-detection-checkbox")
    aiCheckbox.addEventListener("click", () => {

        if (!loadedAI) {

            // Lazy load all the necessary scripts
            const scripts = [
                "lib/class_names.js",
                "lib/postprocess.js",
                "lib/yolo.js"
            ]

            loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@0.9.0").then(() => {
                Promise.all(scripts.map(s => loadScript(s))).then(async () => {

                    aiSection.style.display = "block"

                    model = await downloadModel()
                    yoloSpinner.remove()

                    loadedAI = true
                    window.aiTurnedOn = true

                    // Active checkboxes
                    let yoloActiveClasses = window.localStorage.getItem("yoloActiveClasses")
                    if (yoloActiveClasses) {
                        yoloActiveClasses = JSON.parse(yoloActiveClasses)

                        Object.keys(yoloActiveClasses).forEach(key => {
                            activeClasses[key] = yoloActiveClasses[key]
                        })
                    }

                    // Cached colours
                    let yoloClassColours = window.localStorage.getItem("yoloClassColours")
                    if (yoloClassColours) {
                        yoloClassColours = JSON.parse(yoloClassColours)

                        Object.keys(yoloClassColours).forEach(key => {
                            classColours[key] = yoloClassColours[key]
                        })
                    }

                    // Add all the classification groups' toggles and colour inputs
                    Object.keys(classColours).forEach(key => {

                        const labelElem = document.createElement("label")
                        labelElem.for = `aiCheckbox-${key}`

                        const checkboxElem = document.createElement("input")
                        checkboxElem.type = "checkbox"
                        checkboxElem.checked = activeClasses[key]
                        labelElem.appendChild(checkboxElem)

                        checkboxElem.addEventListener("click", () => {
                            activeClasses[key] = checkboxElem.checked
                            window.localStorage.setItem("yoloActiveClasses", JSON.stringify(activeClasses))
                        })

                        const labelText = document.createElement("span")
                        labelText.innerText = capitalize(key)
                        labelElem.appendChild(labelText)

                        const jsColorInput = document.createElement("input")
                        const jsColorElem = new jscolor(jsColorInput)
                        jsColorElem.fromString(classColours[key])
                        jsColorInput.readonly = true

                        jsColorElem.onFineChange = () => {
                            classColours[key] = jsColorElem.toHEXString().slice(1, 7)
                            window.localStorage.setItem("yoloClassColours", JSON.stringify(classColours))
                        }

                        const container = document.createElement("div")
                        container.appendChild(labelElem)
                        container.appendChild(jsColorInput)
                        aiSection.appendChild(container)
                    })
                })
            })

        } else {
            window.aiTurnedOn = aiCheckbox.checked
            aiSection.style.display = window.aiTurnedOn ? "block" : "none"
        }

        if (!window.aiTurnedOn) {
            detectionContext.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height)
        }
    })

    inferenceIntervalInput.addEventListener("change", () => {
        inferenceInterval = parseInt(inferenceIntervalInput.value)
        localStorage.setItem("inferenceInterval", inferenceInterval)
    })
}


//# sourceMappingURL=websight.concat.js.map