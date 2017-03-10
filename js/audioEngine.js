var audioContext, microphoneCapture, inputGain, analysis, outputGain, nullgain;
var canvasObject, barkBands;

window.onload = function () {
    // Build the audio contexts
    audioContext = new(window.AudioContext || window.webkitAudioContext);

    inputGain = audioContext.createGain();//control sound volume
    outputGain = audioContext.createGain();
    nullgain = audioContext.createGain();
    analysis = audioContext.createAnalyser();//获取频谱能量值，所有音频数据都会经过analyser，我们再从analyser中获取频谱的能量信息，将其画出到Canvas即可
    analysis.fftSize = 2048;
    inputGain.connect(outputGain);
    outputGain.connect(audioContext.destination);//连接硬件
    outputGain.gain.value = 0;
    inputGain.connect(analysis);
    nullgain.gain.value = 0;
    nullgain.connect(outputGain);

    barkBands = xtract_init_bark(analysis.fftSize, audioContext.sampleRate);//采样率

    // Get the microphone
    document.getElementById("microphone").onclick = function (event) {
    	event.currentTarget.style.background="url(img/Pause-microphone.png) no-repeat 0 7px";
        var text = event.currentTarget.textContent;
        if (text == "Failed") {
            return;
        }
        if (microphoneCapture == undefined) {
            return captureMicrophone(event.currentTarget);
        }
        if (text == "Stop") {
              microphoneCapture.disconnect();
            event.currentTarget.textContent = "Listen";
            event.currentTarget.style.background="url(img/Listen.png) no-repeat 2px 7px";
            return;
        }
        if (text == "Listen") {
            microphoneCapture.connect(inputGain);
            event.currentTarget.textContent = "Stop";
            event.currentTarget.style.background="url(img/Pause-microphone.png) no-repeat 0 7px";
            return;
        }
    }
    
    document.getElementById("operate").onclick = function (event) {
        if (audioContext.state == "running") {
            audioContext.suspend();
            event.currentTarget.textContent = "Start";
            event.currentTarget.style.background="url(img/start.png) no-repeat -1px -1px";
        } else {
            audioContext.resume();
            event.currentTarget.textContent = "Pause";
            event.currentTarget.style.background="url(img/pause.png) no-repeat -1px -1px";
        }
    }
    

    document.getElementById("mute").onclick = function (event) {
        if (event.currentTarget.checked) {
            outputGain.gain.value = 0;
        } else {
            outputGain.gain.value = 1;
        }
    }

    document.getElementById("gain").onmousemove = function (event) {
        var linear = Math.pow(10, event.currentTarget.value / 20);
        if (linear != inputGain.gain.value) {
            inputGain.gain.value = linear;
        }
    }
    
    document.getElementById("refresh").onclick = function(event) {
        canvasObject.analysis.change(canvasObject.analysis.element.value);
    }

    canvasObject = new canvasDraw(analysis);
    document.getElementById("formants").innerText+=LPCFormantEstimation(7418);
    
}

function captureMicrophone(element) {//start的按钮事件
    function initStream(stream) {
        microphoneCapture = audioContext.createMediaStreamSource(stream);
        microphoneCapture.connect(inputGain);
        element.textContent = "Stop";
        canvasObject.analysis.element.value = "rms";
        canvasObject.analysis.change("rms");
    }

    function streamError(error) {
        if (navigator.userAgent.search("Chrome") != -1) {
            alert("You're using Chrome! Chrome has decided to break protocol and not support microphone capturing if a site doesn't pay for an SSL key. Use Firefox or Edge.")
        } else if (navigator.userAgent.search("Safari") != -1) {
            alert("You're using Safari! Safari has not updated their code base to support all HTML5 features! Use Firefox or Edge")
        } else {
            alert("Sorry, you're browser is not supported. Please use Firefox (v40 or later) or Edge");
        }
        element.textContent = "Failed!";
        element.disabled = true;
    }

    if (navigator.getUserMedia) {
        navigator.getUserMedia({
            audio: true
        }, initStream, streamError);
    } else if (navigator.webkitGetUserMedia) {
        navigator.webkitGetUserMedia({
            audio: true
        }, initStream, streamError);
    } else if (navigator.mediaDevices) {
        if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
            audio: true
        }).then(initStream);
        } else {
            streamError();
        }
    } else {
        streamError();
    }
    
    
}

var canvasDraw = function (analysisNode) {
    // Special function to draw the canvas and handle callbacks

    this.canvas = document.getElementById("canvas");
    this.canvasContext = this.canvas.getContext("2d");
    var documentWidth=window.screen.availWidth;
   // this.canvas.width=0.9*documentWidth;
    //this.canvas.height=200;

    this.analysisNode = analysisNode;

    this.analysis = {
        element: document.getElementById("analysis"),
        parent: this,
        history: [],
        max_history: this.canvas.width,
        type: "time",
        func: function (data) {
            return 0;
        },
        change: function (value) {
            switch (value) {
                case "rms":
                    this.func = function (data) {
                        var val =  20.0 * Math.log10(data.rms_amplitude());
                        return Math.max(val,-192); // Max dB of 32-bit
                    };
                    break;
                case "skewness":
                    this.func = function (data) {
                        return data.skewness();
                    };
                    break;
                case "spectralCentroid":
                    this.func = function (data) {
                        return data.result.spectrum.spectral_centroid();
                    };
                    break;
                case "loudness":
                    this.func = function (data) {
                        return data.result.spectrum.loudness();
                    };
                    break;
                case "sharpness":
                    this.func = function (data) {
                        return data.result.spectrum.sharpness();
                    };
                    break;
                case "tonality":
                    this.func = function (data) {
                        return data.result.spectrum.tonality();
                    };
                    break;
                case "smoothness":
                    this.func = function (data) {
                        return data.result.spectrum.smoothness();
                    };
                    break;
            }
            switch (value) {
                case "mean":
                case "variance":
                default:
                    this.type = "time";
                    this.max_history = this.parent.canvas.width;
                    this.history = [];
                    break;
            }
        },
        handleEvent: function(event) {
            this.change(event.currentTarget.value);
        },
        addFrame: function (frame) {
            if (this.history.length >= this.max_history) {
                this.history = this.history.slice(1);
            }
            this.history.push(frame);
        }
    }
    this.analysis.element.addEventListener("change", this.analysis);

    this.callback = function (data) {
        this.analysis.addFrame(this.analysis.func(data));
        this.draw(this.analysis.history);
    };

    this.mean = {
        element: document.getElementById("show-mean"),
        display: document.getElementById("show-mean-value"),
        mean: 0,
        show: false,
        handleEvent: function(event) {
            this.show = event.currentTarget.checked;
        },
        call: function(data) {
            this.mean = xtract_mean(data);
            this.display.textContent = this.mean.toPrecision(3);
            return this.mean;
        }
    }
    this.mean.element.addEventListener("change",this.mean);
    
    this.draw = function () {
        // Clear the canvas
        var canvContext = this.canvasContext;
        canvContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
        canvContext.strokeStyle = "#808080";

        // First get the frame size and draw in the divisions
        // RHS == time 0;
        var fft = this.analysisNode.fftSize;
        var tpf = fft / this.analysisNode.context.sampleRate;
        var maxT = this.canvas.width * tpf;
        var div = 5; // Divisions of 5 seconds
        time = 0.0;
        var pps = 1 / tpf;
        var pixX = canvas.width - 1;
        canvContext.strokeStyle = "#aaa";
        canvContext.font = "15px Arial";
        canvContext.fillStyle = "#aaa";
        canvContext.setLineDash([2, 1]);
        var i = 0;
        while (pixX > 0) {
            canvContext.beginPath();
            canvContext.moveTo(pixX, 0);
            canvContext.lineTo(pixX, this.canvas.height);
            canvContext.stroke();
            if (i % 4 == 1) {
                canvContext.fillText("-" + time.toString().substr(0, 3), pixX - 5, 15);
            }
            i++;
            time += div;
            pixX -= (pps * div);
        }

        if (this.analysis.type == "time") {
            // Get Min/Max
            var min = xtract_array_min(this.analysis.history);
            var max = xtract_array_max(this.analysis.history);
            var MaxMin = max - min;
            var pixY = canvas.height;
            var ppd = canvas.height / 50;
            var upd = (max - min) / 50;
            var unit = min;
            i = 0;
            while (pixY >= 0) {
                canvContext.beginPath();
                canvContext.moveTo(0, pixY);
                canvContext.lineTo(canvas.width, pixY);
                canvContext.stroke();
                if (i % 4 == 0) {
                    canvContext.fillText(unit.toExponential(2), 10, pixY + 5);
                }
                i++;
                pixY -= ppd;
                unit += upd;
            }
            //canvContext.setLineDash([0]);
            canvContext.strokeStyle = "#f66";
            canvContext.setLineDash([0]);
            pixX = canvas.width;
            canvContext.beginPath();
            var data = this.analysis.history;
            canvContext.moveTo(pixX, (1 - (data[data.length - 1] - min) / MaxMin) * canvas.height);
            pixX--;
            for (i = data.length - 2; i >= 0 && pixX > 0; i--) {
                canvContext.lineTo(pixX, (1 - (data[i] - min) / MaxMin) * canvas.height);
                pixX--;
            }
            canvContext.stroke();
            
            if (this.mean.show) {
                var mean = this.mean.call(data);
                pixY = (1-(mean-min)/MaxMin)*canvas.height;
                canvContext.strokeStyle = "#6f6";
                canvContext.beginPath();
                canvContext.moveTo(0,pixY);
                canvContext.lineTo(canvas.width,pixY);
                canvContext.stroke();
            }
        }
    }

    this.analysisNode.frameCallback(this.callback, this);
    this.analysisNode.callbackObject.connect(nullgain);
}

//Fs:传入频率
function LPCFormantEstimation(Fs){
	var x=[0.422947892942498,0.469493936422016,0.573785894130969,0.635811581011049,0.460267821044956
,0.209077609910338,-0.0136800574145255,-0.250350661799950,-0.441388392449557,-0.630889332050399];
	/*var dt=1/Fs;
	var I0=Math.round(0.1/dt);
	var Iend=Math.round(0.25/dt);
	var x=new Array();
	for (var i=I0;i<=Iend;i++) {
		x[i]=speech[i];
	}*/
	var x1=[],angz;
	for (var i=0;i<x.length;i++) {
		x1[i]=x[i]*hamming(x.length)[i];
	}
	var preemph=[1,0.63];
	var x2=mFilter(1,preemph,x1); //filter
	var x3=[];
	x3=createZeros(x2);  //构造一个虚部全为0，长度和实部相同的数组
   	var n=x2.length;
   	var a=mLpc(x2,x3,n);
   	var real=[],imag=[];
   	roots(a,real,imag);//复数的格式处理
   	var rts=[],its=[];
   	var j=0;
   	for (var i=0;i<imag.length;i++) {
   		if (imag[i]>=0) {
   			its[j]=imag[i];
   			rts[j]=real[i];
   			j++;
   		}
   	}                       //rts(imag(rts1)>=0);
   	var angz=[];
	for (var i=0;i<its.length;i++) {
		angz[i]=Math.atan2(its[i],rts[i]);
	}
	var frqs=[];
	for (var i=0;i<angz.length;i++) {
		frqs[i]=angz[i]*(Fs/(2*Math.PI));
	}
	
	var indices=sortArray(frqs);
	frqs.sort(sortNumber);
	var bw=[];
	var rrts=[];
	var irts=[];
	for (var i=0;i<rts.length;i++) {
		rrts[i]=rts[indices[i]-1];
		irts[i]=its[indices[i]-1];
	}
	var bw=[];
	for (var i=0;i<rrts.length;i++) {
		bw[i]=-1/2*(Fs/(2*Math.PI))*Math.log(abs(rrts[i],irts[i]));
	}
	var nn=0;
	var formants=[];
	for (var i=0;i<frqs.length;i++) {
		if (frqs[i]>90 && bw[i]<400) {
			formants[nn]=frqs[i].toFixed(2);
			nn++;
		}
	}
	return formants;
}

