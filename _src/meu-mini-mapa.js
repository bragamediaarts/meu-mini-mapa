class Utils {

    static map(value, start1, stop1, start2, stop2) {
        const ret = (value - start1) / (stop1 - start1) * (stop2 - start2) + start2
        return ret
    }

    static vw(v) {
        const w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
        return (v * w) / 100
    }

}

class App {

    constructor(params = {}) {

        this.nome = params.nome
        this.ano = params.ano
        this.turma = params.turma
        this.creditos = params.creditos

        this.useFilters = params.useFilters
        this.showGrid = params.showGrid

        this.resources = {
            bma: '../_src/svg/bma.svg',
            bma2: '../_src/svg/bma2.svg',
            volume: '../_src/svg/volume2.svg',
            fullscreen: '../_src/svg/full-screen.svg',
            close: '../_src/svg/close.svg',
        }

        /**
         * This is the url of the map.
         * It gets injected in index.html
         * @type {string}
         */
        this.slug = params.slug

        /**
         * Filename for the background image
         * @type {string}
         */
        this.background = params.mapa || App.defaults.mapa

        /**
         * Filenames for the sounds to load. Do be careful since these filenames
         * are relative to the map folder and not toplevel. Therefore, they will
         * need to be modified later to accomodate to this.
         * @type {Array.<string>}
         */
        this.sounds = params.sons || App.defaults.sons

        /**
         * Definitions of the areas (x, y, w, h).
         * @type {Array.<Object>}
         */
        this.areas = params.areas || App.defaults.areas

        this.shake = params.shake || App.defaults.shake

        /**
         * This is a very important variable, since it constrols whether all the
         * sounds should be loaded before starting the app or if it should rely
         * upon HTML5 audio for a dynamic intelligent caching.
         * Defaults to load with HTML5 audio.
         * @type {boolean}
         */
        this.preloadAudio = params.preloadAudio || App.defaults.preloadAudio

        // ---------------------------------------------------------------------------
        // --- member variables not allowed for customization through params below ---
        // ---------------------------------------------------------------------------

        /**
         * Urls to load relative to this frame
         * @type {Array.<string>}
         */
        this.urls = []

        /**
         * Control variable to prevent double clicks when animating info box.
         * @type {boolean}
         */
        this.animating = false

        /**
         * <audio> elements if `preloadAudio` is set to false.
         * @type {Array.<HTMLElement>}
         */
        this.audios = []

        this.svg = document.getElementById('svg')
        this.snap = Snap('#svg')

        /**
         * @type {Array.<Paper.circle>}
         */
        this.circles = []
        this.circlesMask = []

        /**
         * Node where all tracks connect, so that can control volume.
         * @type {Tone.Volume}
         */
        this.volume = new Tone.Volume(20 * Math.log10(0.8)) // -1.938 dB

        this.isMobile = (/Mobi|Android/i.test(navigator.userAgent))
        this.isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        this.loader = document.querySelector('.loader')
        this.loader.style.left = `calc(50% - ${this.loader.clientWidth / 2}px)`

        this.init()

    }

    init() {

        this.initSvg() // This needs to be first, to set some dimensions vars

        window.addEventListener('resize', () => { this.resize() })
        this.resize()

        this.initCircles()
        this.initUi()
        this.initCredits()
        this.initAudio()
        this.initShake()

        try {
            if (window.screen.orientation.type.includes('landscape')) {
                this.svg.style.visibility = 'visible'
                this.loader.style.visibility = 'visible'
            }
        } catch (e) {
            this.svg.style.visibility = 'visible'
            console.log('Failed hiding stuff in landscape', e)
            this.loader.style.visibility = 'visible'
        }

        if (this.useFilters) {

            // filters
            // const f = this.snap.filter(Snap.filter.saturate(5))
            // const f = this.snap.filter(Snap.filter.sepia(2.5))
            const f = this.snap.filter(Snap.filter.contrast(5))
            // const f = this.snap.filter(Snap.filter.invert(10))
            // const f = this.snap.filter(Snap.filter.saturate(30))
            // const f = this.snap.filter(Snap.filter.saturate(50))

            this.maskGroup = this.snap.group(this.snap.selectAll('circle.mask'))

            this.bgMask.attr({ mask: this.maskGroup, filter: f })
            this.mask = this.snap.select('mask')
        }

        if (this.showGrid) {
            for (let i = 0; i < 13; i++) {
                const x = this.getGridX(i)
                this.snap.line(x, 0, x, this.height).attr({ strokeWidth: 3, stroke: 'rgba(255,0,0,0.3)' })
            }
            this.snap.line(0, this.sobreY, this.width, this.sobreY).attr({ stroke: 'red', strokeWidth: 3 })
            const bbM = this.height - this.bbH / 2
            this.snap.line(0, bbM, this.width, bbM).attr({ stroke: 'red', strokeWidth: 3 })
        }

    }

    initShake() {

        /* eslint-disable-next-line no-unused-vars */
        const shaker = new Shake({
            threshold: 8,
            timeout: 1000
        }).start()
        window.addEventListener('shake', () => {
            this.circles.forEach(circle => this.stopCircle(circle))
        }, false);

        window.addEventListener('orientationchange', () => {
            try {
                if (window.screen.orientation.type.includes('landscape')) {
                    this.svg.style.visibility = 'visible'
                    this.loader.style.visibility = 'visible'
                    Tone.context.resume()
                } else {
                    this.svg.style.visibility = 'hidden'
                    this.loader.style.visibility = 'hidden'
                    Tone.context.suspend()
                }
                this.resize()
            } catch (e) {
                console.log('Failed orientation change callback', e)
            }
        })

    }

    initSvg() {

        this.snap.attr({ filter: 'url(#f1)' })

        const src = `../${this.slug}/${this.background}`
        const url = `url("${src}")`
        // this.svg.style.background = url

        this.ratio = 1.426

        this.width = 1920
        this.height = Number.parseInt(this.width / this.ratio)

        const minWidth = 360
        const minHeight = Number.parseInt(minWidth / this.ratio)

        // css props
        this.svg.style.maxWidth = `${this.width}px`
        this.svg.style.maxHeight = `${this.height}px`
        this.svg.style.minWidth = `${minWidth}px`
        this.svg.style.minHeight = `${minHeight}px`

        // html attribute
        this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`)

        // need to first set some initial dimensions, because resize will rely on this
        this.svg.style.width = '100vw'
        const heightVw = Number(1 / this.ratio).toFixed(2) * 100
        this.svg.style.height = `${heightVw}vw`

        this.bg = this.snap.image(src).attr({ id: 'bg' })
        if (this.useFilters) this.bgMask = this.snap.image(src).attr({ id: 'mask' })

    }

    initCircles() {

        // Create circles
        this.areas.forEach((area, idx) => {

            const w = Utils.map(area.w, 0, 1, 0, this.width)
            const h = Utils.map(area.h, 0, 1, 0, this.height)
            const x = Utils.map(area.x, 0, 1, 0, this.width) + w / 2
            const y = Utils.map(area.y, 0, 1, 0, this.height) + h / 2
            const r = w / 2

            let circle = this.snap.circle(x, y, r).attr({
                'data-sound': idx,
                'z-index': 10
            })

            circle.attr({ fill: 'black' })
            circle.addClass('area')
            circle.addClass('hidden')
            if (this.useFilters) circle.addClass('filters')

            this.circles.push(circle)

            if (this.useFilters) {
                const cMask = circle.clone()
                cMask.addClass('mask')
                this.circlesMask.push(circle)
            }

        })

        // Set click events
        this.circles.forEach(circle => {
            circle.click(() => {
                if (!this.isCirclePlaying(circle)) this.playCircle(circle)
                else this.stopCircle(circle)
            })
        })

    }

    getCircleIdx(circle) {
        return Number.parseInt(circle.attr('data-sound'))
    }

    playCircle(circle) {
        if (Tone.context.state === 'suspended') Tone.context.resume()
        const idx = this.getCircleIdx(circle)
        if (this.preloadAudio) this.players[idx].start()
        else this.audios[idx].play()
        if (this.useFilters) {
            this.maskGroup[idx].removeClass('hidden')
        } else {
            this.circles[idx].addClass('active')
            this.circles[idx].attr({ filter: 'url(\'#f1\')' })
        }
    }

    stopCircle(circle) {
        const idx = this.getCircleIdx(circle)
        if (this.preloadAudio) {
            this.players[idx].stop()
        } else {
            this.audios[idx].pause()
            this.audios[idx].currentTime = 0 // should the sound go back to the beginning or not?
        }
        if (this.useFilters) {
            this.circles[idx].removeClass('active')
            this.maskGroup[idx].addClass('hidden')
        } else {
            this.circles[idx].removeClass('active')
            this.circles[idx].addClass('hidden')
        }
    }

    isCirclePlaying(circle) {
        let ret
        const idx = this.getCircleIdx(circle)
        if (this.preloadAudio) ret = this.players[idx].state === 'started'
        else ret = !this.audios[idx].paused
        return ret
    }

    initAudio() {

        // leave some headroom
        Tone.Master.volume.value = -3 // default is 0

        // apply some compression, in order to remove clipping and better balance the "dynamic mix"
        this.compressor = new Tone.Compressor().toMaster()
        this.volume.connect(this.compressor)

        this.players = []
        this.soundsLoaded = 0

        this.sounds.forEach(sound => {
            const url = `../${this.slug}/${sound}`
            this.urls.push(url)
        })

        if (this.preloadAudio) {
            this.urls.forEach(url => {
                let player = new Tone.Player(url, () => {
                    this.soundsLoaded++
                    // console.log(url, "loaded", this.soundsLoaded)
                    if (this.soundsLoaded === this.sounds.length) {
                        this.loaded()
                    }
                })
                player.loop = true
                player.fadeIn = 0.1
                player.fadeOut = 0.1
                player.volume.value = -12 // optmize for maximum output of speakers
                player.connect(this.volume)
                this.players.push(player)
            })
        } else {

            this.vue = new Vue({
                el: '#audios',
                data: {
                    audios: this.urls
                }
            })

            if (!this.isIos) {
                this.createMediaSources()
                this.loaded()
            } else {
                this.loaded() // consider loaded (for ui purposes) even if not, so that UI interaction can in fact load sounds
            }

        }

        this.volumeSlider = document.getElementById('volumeSlider')
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', () => {
                let db = 20 * Math.log10(this.volumeSlider.value)
                if (db <= -56) db = -120
                this.volume.volume.value = db
            })
        }

        // Resume webkitAudioContext in iOS >= 11, after user interaction
        if (Tone.context.state === 'suspended' && 'ontouchstart' in window) {
            const unlock = () => {
                Tone.context.resume().then(() => {
                    document.body.removeEventListener('touchstart', unlock);
                    document.body.removeEventListener('touchend', unlock);
                    this.createMediaSources()
                    this.loaded()
                });
            };
            document.body.addEventListener('touchstart', unlock, false);
            document.body.addEventListener('touchend', unlock, false);
        }

    }

    createMediaSources() {
        this.audios = document.querySelectorAll('audio')
        this.audios.forEach(audio => {
            Tone.context.createMediaElementSource(audio).connect(this.volume)
        })
    }

    changeVolume(val) {
        let db = 20 * Math.log10(val)
        if (db <= -56) db = -Infinity
        this.volume.volume.value = db
    }

    loaded() {

        // if vue is initialized to the first body element, than for some weird
        // reason the below lines are needed
        // document.querySelector(".loader").remove()
        // Snap.select("#svg").attr({ filter: "" })

        this.loader.remove()
        this.snap.attr({ filter: '' })

        document.body.style.pointerEvents = 'all'

    }

    initUi() {

        const paddingX = 50
        this.paddingX = paddingX

        // BOTTOM BAR
        const bbH = this.isMobile ? 150 : 125
        this.bbH = bbH
        this.bottombar = this.snap.rect(0, this.height - bbH, this.width, bbH).attr({ fill: 'white' })
        const bbY = Number.parseInt(this.bottombar.attr('y'))

        // BMA LOGO (just image)
        const imgH = bbH * 0.6
        const bmaX = this.paddingX / 2

        const bmaW = imgH
        const bmaY = bbY + (bbH - bmaW) / 2
        this.bma = this.snap.image(this.resources.bma, bmaX, bmaY, bmaW, bmaW)
        this.bma.attr({
            id: 'bma'
        })

        // BMA2 (BMA Text Image)
        const r = 1280 / 498
        const bma2X = this.getGridX(1)
        const bma2H = imgH * 0.6
        const bma2Y = bbY + (bbH - bma2H) / 2
        this.bma2 = this.snap.image(this.resources.bma2, bma2X, bma2Y, bma2H * r, bma2H)

        // ESCOLA
        const x = this.getGridX(3)
        const attrs = {
            fontSize: '22px',
            color: '#231F20',
            id: 'escolaText',
            'alignment-baseline': 'hanging',
            'dominant-baseline': 'hanging'
        }

        // -- ESCOLA 1
        this.e1 = this.snap.text(x, bbY, this.nome).attr(attrs)
        const eH = this.e1.getBBox().height
        const ey = bbY + (bbH - eH * 2) / 2
        this.e1.attr('y', ey)

        // -- ESCOLA 2
        this.e2 = this.snap.text(x, bbY, `${this.ano}º Ano, ${this.turma}`).attr(attrs)
        const e2y = ey + eH
        this.e2.attr('y', e2y)

        this.escolaText = this.snap.group(this.e1, this.e2)

        // SOBRE
        const sobreX = this.getGridX(8)
        this.sobre = this.snap.text(sobreX, bbY, 'Sobre o projecto').attr(attrs).attr({
            id: 'sobre',
            textDecoration: 'underline'
        })
        const sobreH = this.sobre.getBBox().height
        const sobreY = bbY + (bbH - sobreH * 2) / 2
        this.sobreY = sobreY
        this.sobre.attr({ y: sobreY })
        this.sobre.click(() => {
            this.creditsGroup.toggleClass('show')
            if (this.creditsGroup.hasClass('show')) this.creditsGroup.attr({ display: 'unset' })
        })

        // COPYRIGHT
        const copyrightY = sobreY + sobreH
        this.copyright = this.snap.text(sobreX, copyrightY, '© 2018').attr(attrs).attr({
            id: 'copyright',
        })

        // FULLSCREEN
        const fsW = imgH
        const fsH = imgH
        const fsX = this.width - paddingX / 2 - fsW
        const fsY = bbY + (bbH - fsW) / 2
        this.fsImage = this.snap.image(this.resources.fullscreen, fsX, fsY, fsW, fsW)
        this.fsImage.attr({ id: 'fsImage' })
        this.fsImage.click(() => {
            screenfull.toggle()
        })
        this.closeBar = this.snap.image(this.resources.close, fsX + fsW * 0.25, fsY + fsH * 0.25, fsW * 0.5, fsH * 0.5).attr({ id: 'closeBar' })

        // VOLUME
        const vx = this.getGridX(10)
        const vw = (this.getGridX(11) - this.getGridX(10)) * 1.1
        const vr = 720 / 122
        const vh = vw / vr
        // const vy = bbY + (bbH - vh) / 2
        const vy = fsY + vh / 2
        this.volumeImage = this.snap.image(this.resources.volume, vx, vy, vw, vh)

        let vcxMin = vx + vw * 0.22
        let vcxMax = vx + vw * 0.71
        let vcxStartX = Utils.map(0.8, 0, 1, vcxMin, vcxMax)
        const vcy = vy + vh / 2
        // const vcr = 30
        const vcr = this.isMobile ? 14 : 10
        this.volumeCircle = this.snap.circle(vcxStartX, vcy, vcr)
            .addClass('pointer-hover')
            .attr({
                fill: 'white',
                stroke: 'black',
                strokeWidth: 3
            })

        this.volumeCircleLastX = Number(this.volumeCircle.attr('cx'))

        this.volumeCircle.drag((dx) => {
            let dragX = this.volumeCircleLastX + Number(dx) * 1.5
            if (dragX <= vcxMin) dragX = vcxMin
            else if (dragX >= vcxMax) dragX = vcxMax
            this.volumeCircle.attr({ cx: dragX })
            this.changeVolume(Utils.map(dragX, vcxMin, vcxMax, 0, 1))
        }, () => {
            this.volumeCircleLastX = Number(this.volumeCircle.attr('cx'))
        }, () => {
            // this.volumeCircleLastX = Number(this.volumeCircle.attr('cx'))
        })

        this.bottombarGroup = this.snap.group(
            this.bottombar,
            this.bma,
            this.bma2,
            this.escolaText,
            this.sobre,
            this.copyright,
            this.volumeImage,
            this.volumeCircle,
            this.fsImage
        ).attr({ id: 'bottombarGroup' })

        if (!screenfull.enabled && !window.parent.screenfull.enabled) {
            this.fsImage.remove()
        }

        // check if enabled, since in iOS devices it's not available
        if (window.parent.screenfull.enabled || window.screenfull.enabled) {
            screenfull.on('change', () => {
                if (screenfull.isFullscreen) this.bottombarGroup.addClass('hide')
                else this.bottombarGroup.removeClass('hide')
                // need to listen to event, since going full screen takes some time to resolve
                if (this.isMobile) {
                    if (screenfull.isFullscreen) window.screen.orientation.lock('landscape')
                    else window.screen.orientation.unlock()
                }
                setTimeout(() => { this.resize() }, 100)
            })
        }

        this.resize()

    }

    getGridX(igrid) {
        const gridStep = (this.width - 2 * this.paddingX) / 12
        return this.paddingX + gridStep * igrid
    }

    initCredits() {

        const x1 = this.getGridX(8)
        const x2 = this.width - this.paddingX
        const h = 0.7 * this.height
        const w = this.width - x1
        const y1 = this.height - this.bbH - h
        const y2 = y1 + h
        this.credits = this.snap.rect(x1, y1, w, h).attr({
            fill: '#F5F5F5'
        })

        // Foreign object version
        const x = x1
        const y = y1
        const padding = 30
        const textX = x + padding
        const textY = y + padding
        // const textWidth = w - 2 * padding
        const textWidth = x2 - x1 - padding * 2
        const textHeight = h - 2 * padding
        const fobj = `
            <foreignObject id="creditsText" width="${textWidth}" height="${textHeight}" x=${textX} y=${textY}>
                <p>
                    ${this.creditos}
                </p>
            </foreignObject>
        `
        this.creditsText = Snap.parse(fobj);
        this.snap.append(this.creditsText);
        this.creditsText = this.snap.select('#creditsText')
        // this.creditsText(() => { this.onClick() })

        this.creditsText.attr({
            visibility: 'visible',
            fontFamily: 'AkkuratStd-Regular',
            fontSize: '24px',
            color: 'rgba(0, 0, 0, 1)'
        })

        const closeX = x2
        const closeY = textY
        const closeW = padding
        this.creditsClose = this.snap.image(this.resources.close, closeX, closeY, closeW, closeW)
            .addClass('pointer-hover')

        this.creditsClose.click(() => {
            this.creditsGroup.toggleClass('show')
        })

        this.creditsGroup = this.snap.group(this.credits, this.creditsText, this.creditsClose)
            .attr({ id: 'creditsGroup', display: 'none' })

        this.creditsGroup.node.addEventListener('transitionend', () => {
            if (!this.creditsGroup.hasClass('show')) this.creditsGroup.attr('display', 'none')
        })

    }

    resize() {

        this.svg.style.width = '100vw'
        this.svg.style.height = `${100 / this.ratio}vw`

        let svgWidthVw = this.svg.style.width.replace('vw', '')
        let svgHeightVw = this.svg.style.height.replace('vw', '')
        let svgWidthPx = Utils.vw(svgWidthVw)
        let svgHeightPx = Utils.vw(svgHeightVw)

        if (svgHeightPx > window.parent.window.innerHeight) {
            svgHeightVw = window.parent.window.innerHeight / Utils.vw(100) * 100 // reduce height
            svgWidthVw = svgHeightVw * this.ratio
        } else if (svgWidthPx > window.parent.window.innerWidth) {
            svgWidthVw = window.parent.window.innerWidth / Utils.vw(100) * 100
            svgHeightVw = svgWidthVw / this.ratio
        }
        // Update both dimensions
        this.svg.style.height = `${svgHeightVw}vw`
        this.svg.style.width = `${svgWidthVw}vw`

        const h = this.svg.clientHeight || this.svg.parentNode.clientHeight
        this.loader.style.top = `${h / 2 - this.loader.clientHeight / 2}px`

    }

}

App.defaults = {
    mapa: 'mapa.jpg',
    shake: true,
    preloadAudio: false,
    areas: [
        { // 1
            x: 0.010,
            y: 0.130,
            w: 0.230,
            h: 0.368
        },
        { // 2
            x: 0.243,
            y: 0.100,
            w: 0.125,
            h: 0.200
        },
        { // 3
            x: 0.380,
            y: 0.130,
            w: 0.230,
            h: 0.368
        },
        { // 4
            x: 0.613,
            y: 0.100,
            w: 0.125,
            h: 0.200
        },
        { // 5
            x: 0.755,
            y: 0.130,
            w: 0.230,
            h: 0.368
        },
        { // 6
            x: 0.010,
            y: 0.540,
            w: 0.230,
            h: 0.368
        },
        { // 7
            x: 0.243,
            y: 0.525,
            w: 0.125,
            h: 0.200
        },
        { // 8
            x: 0.380,
            y: 0.540,
            w: 0.230,
            h: 0.368
        },
        { // 9
            x: 0.613,
            y: 0.525,
            w: 0.125,
            h: 0.200
        },
        { // 10
            x: 0.755,
            y: 0.540,
            w: 0.230,
            h: 0.368
        }
    ],
    sons: [
        '1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3', '6.mp3', '7.mp3', '8.mp3', '9.mp3', '10.mp3'
    ]
}

/* eslint-disable no-unused-vars, no-param-reassign */
Snap.plugin(function (Snap, Element, Paper, glob) {
    Paper.prototype.multitext = function (x, y, txt) {
        txt = txt.split('\n');
        let t = this.text(x, y, txt);
        t.selectAll('tspan:nth-child(n+2)').attr({
            dy: '1.2em',
            x: x
        });
        return t;
    };
});

/* eslint-disable-next-line no-var, vars-on-top */
var app

document.addEventListener('DOMContentLoaded', function () {
    const encoded = window.location.hash.replace(/#/, '')
    const decoded = decodeURIComponent(encoded)
    const MeuMiniMapaConfig = JSON.parse(decoded)
    MeuMiniMapaConfig.shake = true
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    MeuMiniMapaConfig.preloadAudio = false // true is buggy atm
    MeuMiniMapaConfig.useFilters = true
    MeuMiniMapaConfig.showGrid = false
    app = new App(MeuMiniMapaConfig)
})

if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
}
