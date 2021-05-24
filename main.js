import * as THREE from './build/three.module.js'
import { ARButton } from './jsm/webxr/ARButton.js' //button to toggle AR
import { OrbitControls } from './jsm/controls/OrbitControls.js' //controlling the 3D Model
import { GLTFLoader } from './jsm/loaders/GLTFLoader.js' //Load Models in GLTF format

let container
let camera, scene, renderer
let reticle, pmremGenerator, current_object, controls
let boardModel, shoeModel
let group = new THREE.Object3D()
let hitTestSource = null
let hitTestSourceRequested = false
let touchDown, touchX, touchY, deltaX, deltaY

const initialBoardBox = new THREE.Box3()
const initialScaleBoardBox = new THREE.Box3()
const sliderBoardBox = new THREE.Box3()
let firstBoard, middleBoard, lastBoard

const initialShoeBox = new THREE.Box3()
const initialScaleShoeBox = new THREE.Box3()
const sliderShoeBox = new THREE.Box3()
let firstShoe, middleShoe, lastShoe

let PositionShoeBox = new THREE.Box3()
let PositionBoardBox = new THREE.Box3()


eruda.init()
init()
animate()

 //***** Main functions *****
function init() {
    container = document.createElement( 'div' )
    document.getElementById("container").appendChild( container )

    setScene()

    let options = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay']
    }
    //everything in content gets displayed while in AR
    options.domOverlay = {root: document.getElementById('content')}

    //Create button that indicates AR compatibility
    //Initiates AR session when clicked
    document.body.appendChild( ARButton.createButton(renderer, options) )

    setShoeSizes()
    setBoardSizes()
    setFootPositions()
    loadModels()

    //console.log(`Initiated!`)
}

function rotateObject(){
    if(current_object && reticle.visible){
        current_object.rotation.y += deltaX / 100
    }
    PositionShoeBox.setFromObject(shoeModel)
    PositionBoardBox.setFromObject(boardModel)
}

function loadModels() {
    const manager = new THREE.LoadingManager()

    manager.onProgress = function(){
        $("#placeBtn").text("Loading").prop("disabled", true).addClass("loadingDots")
    }

    manager.onLoad = function(){
        $("#placeBtn").text("Place Board").prop("disabled", false).removeClass("loadingDots")
    }


    const loader = new GLTFLoader( manager )

    loader.load("Models/skateboardModel/scene.gltf", function(gltf) {  
        boardModel = gltf.scene
        //console.log("Board Model loaded!")
        group.add( boardModel )

        initialBoardBox.setFromObject(boardModel)
        //getBoxDimensions("initialBoardBox", initialBoardBox)

        let initialSliderVal = convertToBoardSize(middleBoard)
        let zWidthBoard = (initialBoardBox.max.z - initialBoardBox.min.z).toFixed(10)
        let scaleFactor = (initialSliderVal/zWidthBoard).toFixed(10)
        boardModel.scale.x = scaleFactor
        boardModel.scale.y = scaleFactor
        boardModel.scale.z = scaleFactor
        
        initialScaleBoardBox.setFromObject(boardModel)
        //getBoxDimensions("initialScaleBoardBox", initialScaleBoardBox)

    }, undefined /*onProgress function*/, function ( error ) {
        console.error( error )
    } )

    loader.load("Models/shoeModel/scene.gltf", function(gltf) {  
        shoeModel = gltf.scene
        positionFeetOnBoard()

        //console.log("Shoe Model loaded!")
        group.add( shoeModel )

        initialShoeBox.setFromObject(shoeModel)
        //getBoxDimensions("initialShoeBox", initialShoeBox)

        let initialSliderVal = convertToMeter(middleShoe)
        let zLengthShoe = (initialShoeBox.max.z - initialShoeBox.min.z).toFixed(10)
        let scaleFactor = (initialSliderVal/zLengthShoe).toFixed(10)
        shoeModel.scale.x = scaleFactor
        shoeModel.scale.y = scaleFactor
        shoeModel.scale.z = scaleFactor
        
        initialScaleShoeBox.setFromObject(shoeModel)
        //getBoxDimensions("initialScaleShoeBox", initialScaleShoeBox)

    }, undefined /*onProgress function*/, function ( error ) {
        console.error( error )
    } )
}

function placeAR(){
    if ( reticle.visible ) {
        scene.add( group )

        //console.log( "Group added to scene!")
        current_object = group
        current_object.position.setFromMatrixPosition( reticle.matrix )
        current_object.visible = true
        current_object.rotation.y = -160 //set feet in looking direction

        controls.update()
        render()
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()

    //set size at which to render app to width and height of browser window
    renderer.setSize( window.innerWidth, window.innerHeight )
}

function animate() {
    //get number of times screen is refreshed (usually 60 FPS)
    //requestAnimationFrame( animate )

    //call every available frame
    renderer.setAnimationLoop( render )
    controls.update()
    console.log("animate")
}

function render( timestamp, frame ) {

    if ( frame ) {
        const referenceSpace = renderer.xr.getReferenceSpace()
        const session = renderer.xr.getSession()

        if ( hitTestSourceRequested === false ) {

            session.requestReferenceSpace( 'viewer' ).then( function ( referenceSpace ) {

                session.requestHitTestSource( { space: referenceSpace } ).then( function ( source ) {

                    hitTestSource = source

                } )

            } )

            //hide reticle and center object in screen when session ends
            session.addEventListener( 'end', function () {

                hitTestSourceRequested = false
                hitTestSource = null

                reticle.visible = false

                // Create smallest possible box that can contain the shape
                // Used to detect collision with other objects
                const box = new THREE.Box3()
                box.setFromObject(current_object)
                box.center(controls.target)

                //hide place button when reticle is not visible
                document.getElementById("placeBtn").style.display = "none"
                document.getElementById("sliderMenuBtn").style.display = "none"
            } )

            hitTestSourceRequested = true

        }

        // If hit test successful
        if ( hitTestSource ) {

            const hitTestResults = frame.getHitTestResults( hitTestSource )
            
            //Show ring (reticle) for object placement when hit test has a result
            if ( hitTestResults.length ) {

                const hit = hitTestResults[ 0 ]

                //show place button when reticle is visible
                document.getElementById("placeBtn").style.display = "block"
                document.getElementById("sliderMenuBtn").style.display = "block"

                reticle.visible = true
                reticle.matrix.fromArray( hit.getPose( referenceSpace ).transform.matrix )

            } else {

                reticle.visible = false

            }

        }

    }

    //draw scene everytime screen is refreshed 
    renderer.render( scene, camera )
}


//***** DOM handling *****
$("#placeBtn").on("click", function() {
    placeAR()
})

$("#sliderMenuBtn").on("click", function(){
    $("#sliderMenu").slideToggle()
    $(this).html(($(this).html() == '<i class="arrow up"></i>') ? '<i class="arrow down"></i>' : '<i class="arrow up"></i>')
})

//Initiate Rangeslider
$('input[type="range"]').rangeslider({
    polyfill: false //change appearance on older browsers
})

//generate rangesliders
function setShoeSizes(){
    let shoeMin = 35, shoeMax = 45, stepSize = 0.5
    let arr = []
    for(shoeMin; shoeMin <= shoeMax; shoeMin++){
        arr.push(shoeMin)
    }

    firstShoe = arr[0]
    middleShoe = arr[Math.round((arr.length - 1) / 2)]
    lastShoe = arr.slice(-1).pop()
    let content = document.getElementById("shoeContainer")
    let range = document.createElement('input')
    range.setAttribute("type", "range")
    range.setAttribute("id", "shoeSlider")
    range.setAttribute("min", firstShoe)
    range.setAttribute("max", lastShoe)
    range.setAttribute("value", middleShoe)
    range.setAttribute("step", stepSize)
    content.appendChild(range)

    $("#shoeSizeInd").text(middleShoe)

    //console.log(`Shoe sizes set!`)
}

function setBoardSizes(){
    let boardMin = 7, boardMax = 9, stepSize = 0.25
    let arr = []
    for(boardMin; boardMin <= boardMax; boardMin++){
        arr.push(boardMin)
    }

    firstBoard = arr[0]
    middleBoard = arr[Math.round((arr.length - 1) / 2)]
    lastBoard = arr.slice(-1).pop()
    let content = document.getElementById("boardContainer")
    let range = document.createElement('input')
    range.setAttribute("type", "range")
    range.setAttribute("id", "boardSlider")
    range.setAttribute("min", firstBoard)
    range.setAttribute("max", lastBoard)
    range.setAttribute("value", middleBoard)
    range.setAttribute("step", stepSize)
    content.appendChild(range)

    $("#boardSizeInd").text(middleBoard)

    //console.log(`Board sizes set!`)
}

function setFootPositions(){
    let content = document.getElementById("positionContainer")
    let range = document.createElement('input')
    range.setAttribute("type", "range")
    range.setAttribute("id", "positionSlider")
    range.setAttribute("min", 1)
    range.setAttribute("max", 3)
    range.setAttribute("value", 2)
    range.setAttribute("step", 1)
    content.appendChild(range)

    $("#positionInd").text("center")

    //console.log(`Foot positions set!`)
}

//Scale shoes on z-axis according to slider position
$("#shoeSlider").on("input change", function() {
    let curShoeValue = $("#shoeSlider").val()
    $("#shoeSizeInd").text(curShoeValue)

    let sizeLength = convertToMeter(curShoeValue)

    let zLengthShoe = (initialShoeBox.max.z - initialShoeBox.min.z).toFixed(10)
    let scaleFactor = (sizeLength/zLengthShoe).toFixed(10)
    shoeModel.scale.x = scaleFactor
    shoeModel.scale.y = scaleFactor
    shoeModel.scale.z = scaleFactor

    sliderShoeBox.setFromObject(shoeModel)
    //getBoxDimensions("sliderShoeBox", sliderShoeBox)

    adjustPosition()
})

//Scale board on z-axis according to slider position
$("#boardSlider").on("input change", function() {
    let curBoardValue = $("#boardSlider").val()
    $("#boardSizeInd").text(curBoardValue)

    let sizeWidth = convertToBoardSize(curBoardValue)

    let zWidthBoard = (initialBoardBox.max.z - initialBoardBox.min.z).toFixed(10)
    let scaleFactor = (sizeWidth/zWidthBoard).toFixed(10)
    boardModel.scale.x = scaleFactor
    boardModel.scale.y = scaleFactor
    boardModel.scale.z = scaleFactor

    sliderBoardBox.setFromObject(boardModel)
    //getBoxDimensions("sliderBoardBox", sliderBoardBox)

    adjustPosition()
})

//Move feet on x-axis according to slider position
$("#positionSlider").on("input change", function() {
    adjustPosition()
})

//handle touch and move actions to rotate model with finger gestures
renderer.domElement.addEventListener('touchstart', function(e){
    e.preventDefault()
    touchDown = true
    touchX = e.touches[0].pageX
    touchY = e.touches[0].pageY
}, false)

renderer.domElement.addEventListener('touchend', function(e){
    e.preventDefault()
    touchDown = false
}, false)

renderer.domElement.addEventListener('touchmove', function(e){
    e.preventDefault()
    if(!touchDown){
        return
    }

    deltaX = e.touches[0].pageX - touchX
    deltaY = e.touches[0].pageY - touchY
    touchX = e.touches[0].pageX
    touchY = e.touches[0].pageY

    rotateObject()
}, false)

window.addEventListener( 'resize', onWindowResize, false )

//***** Helper functions *****
function convertToMeter(size){
    let length = (((size-2)/(3/2))/100).toFixed(10)
    //console.log(`converted shoe size EUR ${size} to length ${length} meter`)
    return length
}

function convertToBoardSize(size){
    let width = (size/39.37).toFixed(10)
    //console.log(`converted board size in inches ${size} to width ${width} meter`)
    return width
}

function positionFeetOnBoard(){
    shoeModel.translateY(0.12) //move shoes on top of board
    shoeModel.translateZ(-0.04) //move shoes back on the board
}

function getBoxDimensions(name, box){
    console.log(`${name} Dimensions:`)
    let xLength = (box.max.x - box.min.x).toFixed(10)
    let yLength = (box.max.y - box.min.y).toFixed(10)
    let zLength = (box.max.z - box.min.z).toFixed(10)
    console.log(`Length X: ${xLength}`)
    console.log(`Length Y: ${yLength}`)
    console.log(`Length Z: ${zLength}`)
}

function adjustPosition(){
    let curposValue = $("#positionSlider").val()

    //reset shoeModel position
    shoeModel.position.setFromMatrixPosition( boardModel.matrix )
    positionFeetOnBoard()

    PositionShoeBox.setFromObject(shoeModel)
    PositionBoardBox.setFromObject(boardModel)

    let currentBoardMin = PositionBoardBox.min.x
    let currentBoardMax = PositionBoardBox.max.x
    let currentshoeMin = PositionShoeBox.min.x
    let currentshoeMax = PositionShoeBox.max.x

    if(curposValue == 1){
        $("#positionInd").text("left")
        //shoeModel.position.setX(currentBoardMax/2 - currentshoeMax)
        shoeModel.position.setX( currentshoeMin - currentBoardMin )
    }
    else if(curposValue == 2){
        $("#positionInd").text("center")
    }
    else if(curposValue == 3){
        $("#positionInd").text("right")
        shoeModel.position.setX( currentshoeMax - currentBoardMax )
    }
}

//***** Set three.js scene *****
function setScene(){
    scene = new THREE.Scene()

    // set camera with field of view in degrees, aspect ratio, clipping planes to prevent rendering for near and further away objects
    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.001, 200 )

    const light = new THREE.HemisphereLight( 0xffffff, 0xbbbbff, 1 )
    light.position.set( 0.5, 1, 0.25 )
    scene.add( light )

    //render scene in device ratio and fill whole screen
    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } )
    renderer.setPixelRatio( window.devicePixelRatio )
    renderer.setSize( window.innerWidth, window.innerHeight )
    renderer.xr.enabled = true
    container.appendChild( renderer.domElement )

    //TODO: Find out what this does
    //pmremGenerator = new THREE.PMREMGenerator(renderer)
    //pmremGenerator.compileEquirectangularShader()

    //add controls to scene
    controls = new OrbitControls(camera, renderer.domElement)
    controls.addEventListener('change', render)
    controls.minDistance = 2
    controls.maxDistance = 10
    controls.target.set(0, 0, -0.2)
    //smooth rotation
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    //Ring to indicate object placement
    reticle = new THREE.Mesh(
        new THREE.RingBufferGeometry( 0.15, 0.2, 32 ).rotateX( - Math.PI / 2 ),
        new THREE.MeshBasicMaterial()
    )
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add( reticle )

    //console.log(`scene set!`)
}