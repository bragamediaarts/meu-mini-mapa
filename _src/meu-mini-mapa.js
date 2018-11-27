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

        this.useFilters = params.useFilters

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

        this.svg = document.getElementById("svg")
        this.snap = Snap("#svg")

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

        this.loader = document.querySelector(".loader")
        this.loader.style.left = `calc(50% - ${this.loader.clientWidth / 2}px)`

        this.volumeSlider = document.getElementById("volumeSlider")
        this.volumeContainer = document.getElementById("volumeContainer")

        this.init()

        // setTimeout(() => { document.querySelector(".loader").remove() }, 100)

    }

    init() {

        this.initSvg() // This needs to be first, to set some dimensions vars

        window.addEventListener("resize", () => { this.resize() })

        this.resize()

        this.initCircles()
        this.initUi()

        this.initAudio()

        this.initShake()

        try {
            if (window.screen.orientation.type.includes("landscape")) {
                this.svg.style.visibility = "visible"
                this.loader.style.visibility = "visible"
            }
        } catch (e) {
            console.log("Failed hiding stuff in landscape")
            this.svg.style.visibility = "visible"
            this.loader.style.visibility = "visible"
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

        window.addEventListener("orientationchange", () => {
            try {
                if (window.screen.orientation.type.includes("landscape")) {
                    this.svg.style.visibility = "visible"
                    this.loader.style.visibility = "visible"
                    Tone.context.resume()
                } else {
                    this.svg.style.visibility = "hidden"
                    this.loader.style.visibility = "hidden"
                    Tone.context.suspend()
                }
                this.resize()
            } catch (e) {
                console.log("Failed orientation change callback", e)
            }
        })

    }

    initSvg() {

        this.snap.attr({ filter: "url(#f1)" })

        const src = `../${this.slug}/${this.background}`
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
        this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`)

        // need to first set some initial dimensions, because resize will rely on this
        this.svg.style.width = "100vw"
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
            // circle.attr('visibility', 'hidden')
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
                // circle.attr('visibility', 'visible')
                if (!this.isCirclePlaying(circle)) this.playCircle(circle)
                else this.stopCircle(circle)
            })
        })

    }

    getCircleIdx(circle) {
        return Number.parseInt(circle.attr("data-sound"))
    }

    playCircle(circle) {
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
        if (this.preloadAudio) ret = this.players[idx].state === "started"
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
                el: "#audios",
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

        this.volumeSlider = document.getElementById("volumeSlider")
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener("input", () => {
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
        this.audios = document.querySelectorAll("audio")
        this.audios.forEach(audio => {
            Tone.context.createMediaElementSource(audio).connect(this.volume)
        })
    }

    loaded() {

        // if vue is initialized to the first body element, than for some weird
        // reason the below lines are needed
        // document.querySelector(".loader").remove()
        // Snap.select("#svg").attr({ filter: "" })

        this.loader.remove()
        this.snap.attr({ filter: "" })

        if (this.volumeContainer) this.volumeContainer.classList.remove("blur")
        document.body.style.pointerEvents = "all"

    }

    initUi() {

        const paddingX = 20
        const paddingY = 120
        const x = this.width - paddingX
        const y = paddingY

        // TITLE
        const title = `${this.nome}\n${this.ano}º Ano, ${this.turma}`
        this.snap.multitext(x, y, title).attr({
            "font-size": "30px",
            "text-anchor": "end",
            // fill: "rgba(28, 68, 119, 0.95)"
            fill: "#231F20"
        })

        // RECT ATTRS
        const f = this.snap.filter(Snap.filter.shadow(2, 2, 0.5))
        const rectAttrs = {
            // fill: "rgba(28, 68, 119, 0.93)",
            fill: "white",
            rx: 5,
            ry: 5,
            filter: f
        }

        // FULLSCREEN RECT
        this.rectSide = this.isMobile ? 150 : 100
        const rectX = this.width - this.rectSide - paddingX
        const rectY = this.height - this.rectSide - 10
        this.fsRect = this.snap.rect(rectX, rectY, this.rectSide, this.rectSide).attr(rectAttrs)

        // FULLSCREEN IMAGES
        this.fsImage = this.snap.image("../_src/svg/full-screen.svg", rectX + 0.125 * this.rectSide, rectY + 0.125 * this.rectSide, this.rectSide * 0.75, this.rectSide * 0.75)
        this.fsImage.attr({ id: "fsImage" })
        this.fsImage.click(() => { screenfull.toggle() })

        if (!screenfull.enabled) {
            this.fsRect.remove()
            this.fsImage.remove()
        }

        // check if enabled, since in iOS devices it's not available
        if (screenfull.enabled) {
            screenfull.on("change", () => {
                // need to listen to event, since going full screen takes some time to resolve
                if (this.isMobile) {
                    if (screenfull.isFullscreen) window.screen.orientation.lock("landscape")
                    else window.screen.orientation.unlock()
                }
                setTimeout(() => { this.resize() }, 100)
            })
        }

        // CREDITS RECT
        this.creditsX = screenfull.enabled ? rectX - this.rectSide * 1.2 : rectX
        this.creditsY = rectY
        this.credits = this.snap.rect(this.creditsX, this.creditsY, this.rectSide, this.rectSide).attr(rectAttrs).attr({ id: "credits" })

        // CREDITS IMAGE
        this.creditsImage = this.snap.image("../_src/svg/info_w.svg", this.creditsX + 0.125 * this.rectSide, this.creditsY + 0.125 * this.rectSide, this.rectSide * 0.75, this.rectSide * 0.75)
        this.creditsImage.attr({ id: "creditsImage" })
        this.creditsImage.click(() => { this.onClick() })

        // INFO LINK
        const infoX = paddingX
        const infoY = rectY
        this.infoRect = this.snap.rect(infoX, infoY, this.rectSide, this.rectSide).attr(rectAttrs).attr({ id: "infoRect" })
        this.info = this.snap.image(
            "../_src/svg/bma.svg",
            infoX + 0.125 * this.rectSide,
            infoY + 0.125 * this.rectSide,
            this.rectSide * 0.75,
            this.rectSide * 0.75
        ).attr({ id: "info" })
        this.info.click(() => {
            window.open('http://www.bragamediaarts.com/', '_blank');
        })

        // < foreignObject width = ${ volWidth } height = ${ volHeight } x = ${ volX } y = ${ volY }>
        // VOLUME (foreignObject version)
        if (this.volumeContainer) document.getElementById("volumeContainer").style.display = "none"
        const volX = infoX + this.rectSide + this.rectSide / 2
        // const volX = 100
        // const volY = 0
        const volY = !this.isMobile ? infoY : infoY + this.rectSide / 4 - 15
        // console.log(volY)
        // const volY = 100
        const volWidth = 300
        const volHeight = 40
        const fobj = `
        <svg>
            <foreignObject id="fobj" width=${volWidth} height=${volHeight} x=${volX} y=${volY}>
                <div id="volumeContainer2" style="display: table">
                    <div style="display: table-cell; vertical-align: middle"><i class="fa fa-volume-down"></i></div>
                    <div style="display: table-cell; vertical-align: middle"><input type="range" min=0 max=1 step=0.001 id="volumeSlider" value=0.8 /></div>
                    <div style="display: table-cell; vertical-align: middle"><i class="fa fa-volume-up"></i></div>
                </div>
            </foreignObject>
        </svg>
        `
        let p = Snap.parse(fobj)
        this.snap.append(p)
        this.snap.group().append(p)

        this.resize()

    }

    onClick() {

        // let animation run until the end, before being able to trigger another one
        if (this.animating) return

        this.animating = true

        const maximizing = Number.parseInt(this.credits.node.getAttribute("width")) === this.rectSide

        /* eslint-disable-next-line one-var, one-var-declaration-per-line */
        let w, h, w2, h2, x, y, opacity

        // Define values
        if (maximizing) {
            w = 0.30 * this.width
            h = 0.8 * this.height
            w2 = this.credits.node.getAttribute("width")
            h2 = this.credits.node.getAttribute("height")
            x = this.credits.node.getAttribute("x") - w + parseInt(w2)
            y = this.credits.node.getAttribute("y") - h + parseInt(h2)

            opacity = 1

            if (!this.creditsText) {

                // Snap plugin version
                // get text height
                // const attrs = {
                //     fontSize: "30px",
                //     textAnchor: "start",
                //     fill: "white",
                //     opacity: 0
                // }
                // const t = this.snap.text(0, 0, "LOREM").attr(attrs)
                // const textHeight = t.getBBox().height
                // t.remove()
                // const padding = 30
                // const textX = x + padding
                // const textY = y + padding + textHeight
                // this.creditsText = this.snap.multitext(textX, textY, this.creditos).attr(attrs);

                // Foreign object version
                const padding = 30
                const textX = x + padding
                const textY = y + padding
                const textWidth = w - 2 * padding
                const textHeight = h - 2 * padding - this.rectSide
                const fobj = `
                    <foreignObject id="creditsText" width="${textWidth}" height="${textHeight}" x=${textX} y=${textY} opacity="0">
                        <p>
                            ${this.creditos}
                        </p>
                    </foreignObject>
                `
                this.creditsText = Snap.parse(fobj);
                this.snap.append(this.creditsText);
                this.creditsText = this.snap.select("#creditsText")
                // this.creditsText(() => { this.onClick() })

            }

            this.creditsText.attr({ visibility: "visible", fontFamily: 'AkkuratStd-Regular' })


        } else {
            x = this.creditsX
            y = this.creditsY
            w = this.rectSide
            h = this.rectSide
            opacity = 0
        }

        // And then animate
        const duration = 800
        this.credits.animate({
            x: x,
            y: y,
            width: w,
            height: h
        }, duration, mina.easeinout, () => {
            this.animating = false
        })

        if (maximizing) {
            setTimeout(() => {
                this.creditsText.animate({ opacity: opacity }, 300)
            }, 0.9 * duration)
        } else {
            this.creditsText.attr({ opacity: 0, visibility: "hidden" })
        }
    }

    resize() {

        this.svg.style.width = "100vw"
        this.svg.style.height = `${100 / this.ratio}vw`

        let svgWidthVw = this.svg.style.width.replace("vw", "")
        let svgHeightVw = this.svg.style.height.replace("vw", "")
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

        if (this.infoRect) {

            const offX = Number.parseInt(this.svg.getBoundingClientRect().left)
            const rectWidth = Number.parseInt(this.infoRect.attr("width"))
            const realWidth = Number.parseInt(this.svg.getBoundingClientRect().width)
            const viewBoxWidth = this.snap.attr("viewBox").width
            const rectRealX = (realWidth * rectWidth) / viewBoxWidth

            const x = offX + rectRealX + rectRealX

            if (this.volumeContainer) this.volumeContainer.style.left = `${x - 10}px`

        }

        // viewportUnitsBuggyfill.refresh()

    }

}

App.defaults = {
    mapa: "mapa.jpg",
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
        "1.mp3", "2.mp3", "3.mp3", "4.mp3", "5.mp3", "6.mp3", "7.mp3", "8.mp3", "9.mp3", "10.mp3"
    ]
}

/* eslint-disable no-unused-vars, no-param-reassign */
Snap.plugin(function (Snap, Element, Paper, glob) {
    Paper.prototype.multitext = function (x, y, txt) {
        txt = txt.split("\n");
        let t = this.text(x, y, txt);
        t.selectAll("tspan:nth-child(n+2)").attr({
            dy: "1.2em",
            x: x
        });
        return t;
    };
});

/* eslint-disable-next-line no-var, vars-on-top */
var app

document.addEventListener("DOMContentLoaded", function () {
    const encoded = window.location.hash.replace(/#/, "")
    const decoded = decodeURIComponent(encoded)
    const MeuMiniMapaConfig = JSON.parse(decoded)
    MeuMiniMapaConfig.shake = true
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    MeuMiniMapaConfig.preloadAudio = isIos
    MeuMiniMapaConfig.useFilters = true
    app = new App(MeuMiniMapaConfig)
})

if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
}
