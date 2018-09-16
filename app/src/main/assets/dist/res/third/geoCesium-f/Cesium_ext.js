(function(Cesium){
	if(Cesium){
		//是否启用扩展的类，如果为false则使用的为原生类
		Cesium.GeoOption = {
			GeoCamera: true,
			GeoCameraEventAggregator: true,
			GeoScreenSpaceCameraController: true
		};
		
		//版本号
		Cesium.GEO_VERSION_NUMBER = "$ Cesium Version: 1.40 build-20180522 $";
	}
})(window.Cesium);

/**
 * Class: Cesium.DrawHeightWidget
 * 三维地图高度绘制类。
 * @author sunpei
 */
(function(Cesium){
    "use strict";
    /**
     * 三维地图高度绘制插件类
     *
     * @alias DrawHeightWidget
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer].
     * @param {Color} [options.color = Cesium.Color.CHARTREUSE.withAlpha(0.5)] 绘制线颜色.
     * @param {Number} [options.lineWidth=2.0] 绘制面边框宽度.
     * @param {Function(Event)} [callback]
     *
     * @example
     * // 初始化控件.
     * var DrawHeightWidget = new Cesium.DrawHeightWidget({
     *     viewer：viewr
     * });
     */
    var DrawHeightWidget = Cesium.DrawHeightWidget = function(options,callback) {
        this.viewer = options.viewer;
        this.color = options.color?options.color:Cesium.Color.CHARTREUSE.withAlpha(0.5);
        this.lineWidth = options.lineWidth?options.lineWidth:2;
        this.scene = this.viewer.scene;
        this.camera = this.viewer.camera;
        this.canvas = this.scene.canvas;
        this.primitives = this.scene.primitives;
        this.ellipsoid = this.scene.globe.ellipsoid;
        this.callback = callback?callback:null;
    };
    /**
     * 激活控件：激活线绘制插件，左键开始绘制，右键结束绘制
     */
    DrawHeightWidget.prototype.activate = function(){
        if(this.handler) return;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.viewer.canvas.style.cursor = "crosshair";
        var that = this;
        var array = [];//点数组   []
        var polylines,labels;
        this.handler.setInputAction(function(p){
            if(array.length>0) return;
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            if(array.length==0){
                //默认三个点位置相同
                array.push(lng);
                array.push(lat);
                array.push(height);
                array.push(lng);
                array.push(lat);
                array.push(height);
                array.push(lng);
                array.push(lat);
                array.push(height);
                polylines = that.primitives.add(new Cesium.PolylineCollection());
                polylines.name = "draw_polyline";
                polylines.add({
                    polyline:{}
                });
                polylines.get(polylines.length-1).width = that.lineWidth;
                polylines.get(polylines.length-1).loop = true;
                polylines.get(polylines.length-1).material.uniforms.color = that.color;
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
            }
        },Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function(p){
            var ray = that.camera.getPickRay(p.endPosition);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if (!cartesian) {
                if(labels){
                    that.primitives.remove(labels);
                    labels=null;
                }
                return;
            };
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            if (array.length==9) {
                //改变第二个点的值
                array[3] = lng;
                array[4] = lat;
                array[5] = height;
                //根据一二两个点的位置判断第三个点的位置（比较高度）
                if(array[2]>=array[5]){
                    array[6] = array[0];
                    array[7] = array[1];
                    array[8] = array[5];
                }else{
                    array[6] = array[3];
                    array[7] = array[4];
                    array[8] = array[2];
                }
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
            }
            if(!labels){
                labels = that.primitives.add(new Cesium.LabelCollection());
                labels.name = "draw_label";
                labels.add({
                    text : '左键单击开始绘制，右键单击结束绘制',
                    font : '16px sans-serif',
                    showBackground : true
                });
                labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
            }else{
                labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
            }
        },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.setInputAction(function(p){
            that.handler = that.handler && that.handler.destroy();
            that.viewer.canvas.style.cursor = "default";
            //绘制完成,清除提示
            if(labels){
                that.primitives.remove(labels);
                labels=null;
            }
            if(that.callback){
                var entity = new Cesium.Entity({
                    polyline : {
                        positions : Cesium.Cartesian3.fromDegreesArrayHeights(array)
                    }
                });
                that.callback(entity);
            }
        },Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    /**
     * 清除绘制痕迹
     */
    DrawHeightWidget.prototype.clear = function(){
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //清除 绘制痕迹
        clearPrimitiveByName("draw_label",this.primitives);
        clearPrimitiveByName("draw_polyline",this.primitives);
    };
    //清除primitive绘制痕迹
    function clearPrimitiveByName(name,primitives){
        for(var i=0;i<primitives.length;i++){
            if(primitives.get(i).name==name){
                primitives.remove(primitives.get(i));
                i--;
            }
        }
    }
})(window.Cesium);
/**
 * Class: Cesium.DrawPointWidget
 * 三维地图点绘制类。
 * @author sunpei
 */
(function(Cesium){
    "use strict";
    /**
     * 三维地图点绘制插件类
     *
     * @alias DrawPointWidget
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer].
     * @param {Color} [options.color = Cesium.Color.CHARTREUSE.withAlpha(0.5)] 绘制点颜色.
     * @param {Number} [options.pixelSize=10] 绘制点大小.
     * @param {Function(Event)} [callback] 返回绘制点
     *
     * @example
     * // 初始化控件.
     * var DrawPointWidget = new Cesium.DrawPointWidget({
     *     viewer：viewr
     * });
     */
    var DrawPointWidget = Cesium.DrawPointWidget = function(options,callback) {
        this.viewer = options.viewer;
        this.color = options.color?options.color:Cesium.Color.YELLOW;
        this.pixelSize = options.pixelSize?options.pixelSize:10;
        this.scene = this.viewer.scene;
        this.camera = this.viewer.camera;
        this.canvas = this.scene.canvas;
        this.primitives = this.scene.primitives;
        this.ellipsoid = this.scene.globe.ellipsoid;
        this.callback = callback?callback:null;
    };
    /**
     * 激活控件：激活点绘制插件，左键开始绘制，右键结束绘制
     */
    DrawPointWidget.prototype.activate = function(){
        if(this.handler) return;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.viewer.canvas.style.cursor = "crosshair";
        var that = this;
        var array = [];//点数组   [lng,lat,height,...]
        var points,labels;
        this.handler.setInputAction(function(p){
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            array[0]=cartesian;
            if(points){
                points.removeAll();
            }else{
                points = that.primitives.add(new Cesium.PointPrimitiveCollection());
                points.name = "draw_point";
            }

            points.add({
                position : cartesian,
                color : that.color,
                pixelSize :that.pixelSize
            });
            
            that.handler = that.handler && that.handler.destroy();
            that.viewer.canvas.style.cursor = "default";
            //绘制完成,清除提示
            if(labels){
                that.primitives.remove(labels);
                labels=null;
            }
            if(that.callback){
                var entity = new Cesium.Entity({
                    position:array[0],
                    point:{}
                });
                that.callback(entity);
            }
        },Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function(p){
            var ray = that.camera.getPickRay(p.endPosition);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if (!cartesian) {
                if(labels){
                    that.primitives.remove(labels);
                    labels=null;
                }
                return;
            };
            if(!labels){
                labels = that.primitives.add(new Cesium.LabelCollection());
                labels.name = "draw_label";
                labels.add({
                    text : '左键单击进行绘制',
                    font : '15px Microsoft YaHei',
                    showBackground : true
                });
                labels.get(labels.length-1).position = cartesian;
            }else{
                labels.get(labels.length-1).position = cartesian;
            }
        },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    };
    /**
     * 清除绘制痕迹
     */
    DrawPointWidget.prototype.clear = function(){
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //清除 绘制痕迹
        clearPrimitiveByName("draw_label",this.primitives);
        clearPrimitiveByName("draw_point",this.primitives);
    };
    //清除primitive绘制痕迹
    function clearPrimitiveByName(name,primitives){
        for(var i=0;i<primitives.length;i++){
            if(primitives.get(i).name==name){
                primitives.remove(primitives.get(i));
                i--;
            }
        }
    }
})(window.Cesium);
/**
 * Class: Cesium.DrawPolygonWidget
 * 三维地图多边形绘制类。
 * @author sunpei
 */
(function(Cesium){
    "use strict";
    /**
     * 三维地图多边形绘制插件类
     *
     * @alias DrawPolygonWidget
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer].
     * @param {Color} [options.color = Cesium.Color.CHARTREUSE.withAlpha(0.5)] 绘制面颜色.
     * @param {Number} [options.lineWidth=2.0] 绘制面边框宽度.
     * @param {Function(Event)} [callback] 返回绘制多边形
     *
     * @example
     * // 初始化控件.
     * var DrawPolygonWidget = new Cesium.DrawPolygonWidget({
     *     viewer：viewr
     * });
     */
    var DrawPolygonWidget = Cesium.DrawPolygonWidget = function(options,callback) {
        this.viewer = options.viewer;
        this.color = options.color?options.color:Cesium.Color.CHARTREUSE.withAlpha(0.5);
        this.lineWidth = options.lineWidth?options.lineWidth:2;
        this.scene = this.viewer.scene;
        this.camera = this.viewer.camera;
        this.canvas = this.scene.canvas;
        this.primitives = this.scene.primitives;
        this.ellipsoid = this.scene.globe.ellipsoid;
        this.callback = callback?callback:null;
    };
    /**
     * 激活控件
     */
    DrawPolygonWidget.prototype.activate = function() {
        if(this.handler) return;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.viewer.canvas.style.cursor = "crosshair";
        var that = this;
        var array = [];//点数组
        var array1=[];
        var polylines,labels;
        this._array_ = array1;
        this._polylines_ = polylines;
        this._labels_ = labels;
        this.handler.setInputAction(function(p){
            //that.lastP = p;
            //var ray = that.camera.getPickRay(p.position);
            //var cartesian = that.scene.globe.pick(ray,that.scene);
            //if(!cartesian) return;
            //array.push(cartesian);
            //if (array.length==1) {
            //    polylines = that.primitives.add(new Cesium.PolylineCollection());
            //    polylines.name = "draw_polyline";
            //    polylines.add({
            //        polyline:{}
            //    });
            //    polylines.get(polylines.length-1).width = that.lineWidth;
            //    polylines.get(polylines.length-1).loop = true;
            //    polylines.get(polylines.length-1).material.uniforms.color = that.color;
            //    polylines.get(polylines.length-1).positions=array;
            //}
            //if (array.length>3) {
            //    polylines.get(polylines.length-1).positions=array;
            //}
            //that._polylines_ = polylines;
            that.lastP = p;
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            if(!cartesian) return;
            array1.push(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            array.push(lng);
            array.push(lat);
            array.push(height);
            if (array.length==3) {
                polylines = that.primitives.add(new Cesium.PolylineCollection());
                polylines.name = "draw_polyline";
                polylines.add({
                    polyline:{}
                });
                polylines.get(polylines.length-1).width = that.lineWidth;
                polylines.get(polylines.length-1).loop = true;
                polylines.get(polylines.length-1).material.uniforms.color = that.color;
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
            }
            if (array.length>3) {
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
            }
            that._polylines_ = polylines;
        },Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function(p){
            var ray = that.camera.getPickRay(p.endPosition);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            //if (!cartesian) {
            //    if(labels){
            //        that.primitives.remove(labels);
            //        labels=null;
            //    }
            //    return;
            //};
            //if (array.length>=1) {
            //    var tempArray = array.concat();
            //    tempArray.push(cartesian);
            //    polylines.get(polylines.length-1).positions=tempArray;
            //}
            //if(!labels){
            //    labels = that.primitives.add(new Cesium.LabelCollection());
            //    labels.name = "draw_label";
            //    labels.add({
            //        text : '左键单击开始绘制，右键单击结束绘制',
            //        font : '15px Microsoft YaHei',
            //        showBackground : true
            //    });
            //    labels.get(labels.length-1).position = cartesian;
            //}else{
            //    labels.get(labels.length-1).position = cartesian;
            //}
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            if (array.length>=3) {
                var tempArray = array.concat();
                tempArray.push(lng);
                tempArray.push(lat);
                tempArray.push(height);
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(tempArray);
            }
            if(!labels){
                labels = that.primitives.add(new Cesium.LabelCollection());
                labels.name = "draw_label";
                labels.add({
                    text : '左键单击开始绘制，右键单击结束绘制',
                    font : '15px Microsoft YaHei',
                    showBackground : true
                });
                labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
            }else{
                labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
            }
            that._labels_ = labels;
        },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.setInputAction(function(p){
            that.drawEnd(p);
            //that.handler = that.handler && that.handler.destroy();
            //that.viewer.canvas.style.cursor = "default";
            ////绘制完成,清除提示
            //if(labels){
            //    that.primitives.remove(labels);
            //    labels=null;
            //}
            //var ray = that.camera.getPickRay(p.position);
            //var cartesian = that.scene.globe.pick(ray,that.scene);
            //if(!cartesian) return;
            //array.push(cartesian);
            //polylines.get(polylines.length-1).material.uniforms.color = Cesium.Color.DODGERBLUE.withAlpha(0);
            //that.viewer.entities.add({
            //    name:"draw_polygon",
            //    polygon : {
            //        hierarchy : {
            //            positions : array
            //        },
            //        material : that.color
            //    }
            //});
            //if(that.callback){
            //    var entity = new Cesium.Entity({
            //        polygon : {
            //            hierarchy : {
            //                positions : array
            //            }
            //        }
            //    });
            //    that.callback(entity);
            //}

        },Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    /**
     * 面标绘完成
     */
    DrawPolygonWidget.prototype.drawEnd=function(p) {
        if (this._array_.length==0) {
            return;
        }else{
            var array = this._array_;
            var polylines = this._polylines_;
            var labels = this._labels_;
            if (!p) {
                console.log("点击按钮结束绘制");
                p = this.lastP;
            }
            this.handler = this.handler && this.handler.destroy();
            this.viewer.canvas.style.cursor = "default";
            //绘制完成,清除提示
            if (labels) {
                this.primitives.remove(labels);
                labels = null;
            }
            var ray = this.camera.getPickRay(p.position);
            var cartesian = this.scene.globe.pick(ray, this.scene);
            if (!cartesian) return;
            array.push(cartesian);
            polylines.get(polylines.length - 1).material.uniforms.color = Cesium.Color.DODGERBLUE.withAlpha(0);
            this.viewer.entities.add({
                name: "draw_polygon",
                polygon: {
                    hierarchy: {
                        positions: array
                    },
                    material: this.color
                }
            });
            if (this.callback) {
                var entity = new Cesium.Entity({
                    polygon: {
                        hierarchy: {
                            positions: array
                        }
                    }
                });
                this.callback(entity);
            }
            this._array_=[];
            this._polylines_=null;
        }
    }
    /**
     * 清除绘制痕迹
     */
    DrawPolygonWidget.prototype.clear = function() {
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //清除 绘制痕迹
        clearPrimitiveByName("draw_label",this.primitives);
        clearPrimitiveByName("draw_polyline",this.primitives);
        clearEntityByName("draw_polygon",this.viewer.entities);
    };
    //清除primitive绘制痕迹
    function clearPrimitiveByName(name,primitives){
        for(var i=0;i<primitives.length;i++){
            if(primitives.get(i).name==name){
                primitives.remove(primitives.get(i));
                i--;
            }
        }
    }
    //清除entity绘制痕迹
    function clearEntityByName(name,entities) {
        var temp = entities.values;
        for(var i=0;i<temp.length;i++){
            if(temp[i].name == name){
                entities.remove(temp[i]);
                i--;
            }
        }
    }
})(window.Cesium);
/**
 *Class: Cesium.DrawPolylineWidget
 * 三维地图线段绘制类
 * @author sunpei
 */
(function(Cesium){
    "use strict";
    /**
     * 三维地图线段绘制插件类
     *
     * @alias DrawPolylineWidget
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer].
     * @param {Color} [options.color = Cesium.Color.CHARTREUSE.withAlpha(0.5)] 绘制线颜色.
     * @param {Number} [options.lineWidth=2.0] 绘制面边框宽度.
     * @param {Number} [options.mode=1] 1：空间量算，2：贴地量算.
     * @param {Function(Event)} [callback] 返回绘制线段
     *
     * @example
     * // 初始化控件.
     * var DrawPolylineWidget = new Cesium.DrawPolylineWidget({
     *     viewer：viewr
     * });
     */
    var DrawPolylineWidget = Cesium.DrawPolylineWidget = function(options,callback) {
        this.viewer = options.viewer;
        this.color = options.color?options.color:Cesium.Color.CHARTREUSE.withAlpha(0.5);
        this.lineWidth = options.lineWidth?options.lineWidth:2;
        this.scene = this.viewer.scene;
        this.camera = this.viewer.camera;
        this.canvas = this.scene.canvas;
        this.primitives = this.scene.primitives;
        this.ellipsoid = this.scene.globe.ellipsoid;
        this.mode = options.mode?options.mode:1;
        this.callback = callback?callback:null;
    };
    /**
     * 激活控件：激活线绘制插件，左键开始绘制，右键结束绘制
     */
    DrawPolylineWidget.prototype.activate = function(){
        if(this.handler) return;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.viewer.canvas.style.cursor = "crosshair";
        var that = this;
        var array = [];//点数组   [lng,lat,height,...]
        var polylines,labels;
		this._array_ = array;
		this._polylines_ = polylines;
		this._labels_ = labels;
        this.handler.setInputAction(function(p){
			that.lastP = p;
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            array.push(lng);
            array.push(lat);
            array.push(height);
            if (array.length==3) {
                polylines = that.primitives.add(new Cesium.PolylineCollection());
                polylines.name = "draw_polyline";
                polylines.add({
                    polyline:{}
                });
                polylines.get(polylines.length-1).width = that.lineWidth;
                polylines.get(polylines.length-1).material.uniforms.color = that.color;
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
            }
            if (array.length>3) {
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
            }
			that._polylines_ = polylines;
        },Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function(p){
            var ray = that.camera.getPickRay(p.endPosition);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if (!cartesian) {
                if(labels){
                    that.primitives.remove(labels);
                    labels=null;
                }
				that._labels_ = labels;
                return;
            };
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            if (array.length>=3) {
                var tempArray = array.concat();
                tempArray.push(lng);
                tempArray.push(lat);
                tempArray.push(height);
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(tempArray);
            }
            if(!labels){
                labels = that.primitives.add(new Cesium.LabelCollection());
                labels.name = "draw_label";
                labels.add({
                    text : '左键单击开始绘制，右键单击结束绘制',
                    font : '15px Microsoft YaHei',
                    showBackground : true
                });
                labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
            }else{
                labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
            }
			that._labels_ = labels;
        },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.setInputAction(function(p){
			that.drawEnd(p);
        },Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    /**
     * 绘制结束
     */
	DrawPolylineWidget.prototype.drawEnd = function(p){
            var array = this._array_;
            var polylines = this._polylines_;
            var labels = this._labels_;
            if(!p){
                //console.log("点击按钮结束绘制");
                p = this.lastP;
            }
            this.handler = this.handler && this.handler.destroy();
            this.viewer.canvas.style.cursor = "default";
            //绘制完成,清除提示
            if(labels){
                this.primitives.remove(labels);
                labels=null;
            }
            var ray = this.camera.getPickRay(p.position);
            var cartesian = this.scene.globe.pick(ray,this.scene);
            if(!cartesian) return;
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            array.push(lng);
            array.push(lat);
            array.push(height);
            var mode = this.mode;
            if (this.mode ==2) {//贴地绘制 ，默认mode=1，贴地绘制
                this.mode =1;//初始化
                var lerpArray = lerp(array,this.scene);
                //清除空间绘制结果
                //clearPrimitiveByName("draw_polyline",this.primitives);
                polylines.get(polylines.length-1).material.uniforms.color = Cesium.Color.DODGERBLUE.withAlpha(1);
                this.viewer.entities.add({
                    name:"draw_polyline",
                    polyline : {
                        positions : Cesium.Cartesian3.fromDegreesArrayHeights(lerpArray),
                        width : this.lineWidth,
                        material : this.color
                    }
                });
            }
            if(this.callback){
                var entity = new Cesium.Entity({
                    polyline : {
                        positions : Cesium.Cartesian3.fromDegreesArrayHeights(array)
                    }
                });
                this.callback(entity);
            }
	};
    /**
     * 清除绘制痕迹
     */
    DrawPolylineWidget.prototype.clear = function(){
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //清除 绘制痕迹
        clearPrimitiveByName("draw_label",this.primitives);
        clearPrimitiveByName("draw_polyline",this.primitives);
        clearEntityByName("draw_polyline",this.viewer.entities);
    };
    //清除primitive绘制痕迹
    function clearPrimitiveByName(name,primitives){
        for(var i=0;i<primitives.length;i++){
            if(primitives.get(i).name==name){
                primitives.remove(primitives.get(i));
                i--;
            }
        }
    }
    //清除entity绘制痕迹
    function clearEntityByName(name,entities) {
        var temp = entities.values;
        for(var i=0;i<temp.length;i++){
            if(temp[i].name == name){
                entities.remove(temp[i]);
                i--;
            }
        }
    }
    //插值
    function lerp(array,scene) {
        var lerpArray = [];
        //for(var i=0;i<array.length-5;i=i+3){
        for(var i=0;i<array.length/3-1;i++){
            var t = i*3;
            var lng_s = array[t];
            var lat_s = array[t+1];
            var height_s = array[t+2];
            var lng_e = array[t+3];
            var lat_e = array[t+4];
            var height_e = array[t+5];
            //插入起点
            lerpArray.push(lng_s);
            lerpArray.push(lat_s);
            lerpArray.push(height_s);
            //插入插值
            for(var j=0;j<100;j++){//插值数100
                var cartographic_s = {
                    longitude:Cesium.Math.toRadians(lng_s),
                    latitude:Cesium.Math.toRadians(lat_s),
                    height:height_s
                };
                var cartographic_e = {
                    longitude:Cesium.Math.toRadians(lng_e),
                    latitude:Cesium.Math.toRadians(lat_e),
                    height:height_e
                };
                var longitude_lerp = Cesium.Math.lerp(cartographic_s.longitude,cartographic_e.longitude,0.01*(j+1));
                var latitude_lerp = Cesium.Math.lerp(cartographic_s.latitude,cartographic_e.latitude,0.01*(j+1));
                //得到当前地形高度
                var cartographic_lerp ={
                    longitude:longitude_lerp,
                    latitude:latitude_lerp
                }
                var height_lerp = scene.globe.getHeight(cartographic_lerp);

                lerpArray.push(Cesium.Math.toDegrees(longitude_lerp));
                lerpArray.push(Cesium.Math.toDegrees(latitude_lerp));
                lerpArray.push(height_lerp);
            }
            //插入终点
            lerpArray.push(lng_e);
            lerpArray.push(lat_e);
            lerpArray.push(height_e);
        }
        return lerpArray;
    }
})(window.Cesium);
var xp = {version: "1.0.0",createTime:"2018.6.19",author:"xupinhui"}
var doubleArrowDefualParam = {type:"doublearrow",headHeightFactor:.25,
	headWidthFactor:.3,neckHeightFactor:.85,fixPointCount:4,neckWidthFactor:.15}
var tailedAttackArrowDefualParam = {headHeightFactor:.18,headWidthFactor:.3,neckHeightFactor:.85,
    neckWidthFactor:.15,tailWidthFactor:.1,headTailFactor:.8,swallowTailFactor:1};
xp.algorithm = {},xp.algorithm.doubleArrow = function(inputPoint){
	this.connPoint = null;
	this.tempPoint4 = null;
	this.points = inputPoint;
	var result = {controlPoint:null,polygonalPoint:null};
	//获取已经点击的坐标数
	var t = inputPoint.length;
	if (!(2 > t)) {
		if (2 == t) return  inputPoint;
		var o = this.points[0],//第一个点
			e = this.points[1],//第二个点
			r = this.points[2],//第三个点
			t = inputPoint.length;//获取已经点击的坐标数
		//下面的是移动点位后的坐标
		3 == t ? this.tempPoint4 = xp.algorithm.getTempPoint4(o, e, r) : this.tempPoint4 = this.points[3], 3 == t || 4 == t ? this.connPoint = P.PlotUtils.mid(o, e) : this.connPoint = this.points[4];
		var n, g;
		P.PlotUtils.isClockWise(o, e, r) ? (n = xp.algorithm.getArrowPoints(o, this.connPoint, this.tempPoint4, !1), g = xp.algorithm.getArrowPoints(this.connPoint, e, r, !0)) : (n = xp.algorithm.getArrowPoints(e, this.connPoint, r, !1), g = xp.algorithm.getArrowPoints(this.connPoint, o, this.tempPoint4, !0));
		var i = n.length,
			s = (i - 5) / 2,
			a = n.slice(0, s),
			l = n.slice(s, s + 5),
			u = n.slice(s + 5, i),
			c = g.slice(0, s),
			p = g.slice(s, s + 5),
			h = g.slice(s + 5, i);
		c = P.PlotUtils.getBezierPoints(c);
		var d = P.PlotUtils.getBezierPoints(h.concat(a.slice(1)));
		u = P.PlotUtils.getBezierPoints(u);
		var f = c.concat(p, d, l, u);
		var newArray = xp.algorithm.array2Dto1D(f);
		result.controlPoint = [o,e,r,this.tempPoint4,this.connPoint];
		result.polygonalPoint = Cesium.Cartesian3.fromDegreesArray(newArray);
	}
	return result;
},xp.algorithm.getTempPoint4 = function(t, o, e, r){
	this.type =doubleArrowDefualParam.type,
	this.headHeightFactor = doubleArrowDefualParam.headHeightFactor,
	this.headWidthFactor = doubleArrowDefualParam.headWidthFactor,
	this.neckHeightFactor = doubleArrowDefualParam.neckHeightFactor,
	this.neckWidthFactor = doubleArrowDefualParam.neckWidthFactor;
	var n = P.PlotUtils.mid(t, o),
	g = P.PlotUtils.distance(n, e),
	i = P.PlotUtils.getThirdPoint(e, n, 0, .3 * g, !0),
	s = P.PlotUtils.getThirdPoint(e, n, 0, .5 * g, !0);
	i = P.PlotUtils.getThirdPoint(n, i, P.Constants.HALF_PI, g / 5, r), s = P.PlotUtils.getThirdPoint(n, s, P.Constants.HALF_PI, g / 4, r);
	var a = [n, i, s, e],
	l = xp.algorithm.getArrowHeadPoints(a, this.headHeightFactor, this.headWidthFactor, this.neckHeightFactor, this.neckWidthFactor),
	u = l[0],
	c = l[4],
	p = P.PlotUtils.distance(t, o) / P.PlotUtils.getBaseLength(a) / 2,
	h = xp.algorithm.getArrowBodyPoints(a, u, c, p),
	d = h.length,
	f = h.slice(0, d / 2),
	E = h.slice(d / 2, d);
	return f.push(u), E.push(c), f = f.reverse(), f.push(o), E = E.reverse(), E.push(t), f.reverse().concat(l, E)
},xp.algorithm.array2Dto1D = function(array){
	var newArray = [];
	array.forEach(function(elt) {
		newArray.push(elt[0]);
		newArray.push(elt[1]);
	});
	return newArray;
},xp.algorithm.getArrowPoints = function(t, o, e, r){
	this.type =doubleArrowDefualParam.type,
	this.headHeightFactor = doubleArrowDefualParam.headHeightFactor,
	this.headWidthFactor = doubleArrowDefualParam.headWidthFactor,
	this.neckHeightFactor = doubleArrowDefualParam.neckHeightFactor,
	this.neckWidthFactor = doubleArrowDefualParam.neckWidthFactor;
	var n = P.PlotUtils.mid(t, o),
	g = P.PlotUtils.distance(n, e),
	i = P.PlotUtils.getThirdPoint(e, n, 0, .3 * g, !0),
	s = P.PlotUtils.getThirdPoint(e, n, 0, .5 * g, !0);
	i = P.PlotUtils.getThirdPoint(n, i, P.Constants.HALF_PI, g / 5, r), s = P.PlotUtils.getThirdPoint(n, s, P.Constants.HALF_PI, g / 4, r);
	var a = [n, i, s, e],
	l = xp.algorithm.getArrowHeadPoints(a, this.headHeightFactor, this.headWidthFactor, this.neckHeightFactor, this.neckWidthFactor),
	u = l[0],
	c = l[4],
	p = P.PlotUtils.distance(t, o) / P.PlotUtils.getBaseLength(a) / 2,
	h = xp.algorithm.getArrowBodyPoints(a, u, c, p),
	d = h.length,
	f = h.slice(0, d / 2),
	E = h.slice(d / 2, d);
	return f.push(u), E.push(c), f = f.reverse(), f.push(o), E = E.reverse(), E.push(t), f.reverse().concat(l, E)
},xp.algorithm.getArrowHeadPoints = function(t, o, e){
	this.type =	doubleArrowDefualParam.type,
	this.headHeightFactor = doubleArrowDefualParam.headHeightFactor,
	this.headWidthFactor = doubleArrowDefualParam.headWidthFactor,
	this.neckHeightFactor = doubleArrowDefualParam.neckHeightFactor,
	this.neckWidthFactor = doubleArrowDefualParam.neckWidthFactor;
	var r = P.PlotUtils.getBaseLength(t),
	n = r * this.headHeightFactor,
	g = t[t.length - 1],
	i = (P.PlotUtils.distance(o, e), n * this.headWidthFactor),
	s = n * this.neckWidthFactor,
	a = n * this.neckHeightFactor,
	l = P.PlotUtils.getThirdPoint(t[t.length - 2], g, 0, n, !0),
	u = P.PlotUtils.getThirdPoint(t[t.length - 2], g, 0, a, !0),
	c = P.PlotUtils.getThirdPoint(g, l, P.Constants.HALF_PI, i, !1),
	p = P.PlotUtils.getThirdPoint(g, l, P.Constants.HALF_PI, i, !0),
	h = P.PlotUtils.getThirdPoint(g, u, P.Constants.HALF_PI, s, !1),
	d = P.PlotUtils.getThirdPoint(g, u, P.Constants.HALF_PI, s, !0);
	return [h, c, g, p, d];
},xp.algorithm.getArrowBodyPoints = function(t, o, e, r){
	for (var n = P.PlotUtils.wholeDistance(t), g = P.PlotUtils.getBaseLength(t), i = g * r, s = P.PlotUtils.distance(o, e), a = (i - s) / 2, l = 0, u = [], c = [], p = 1; p < t.length - 1; p++) {
		var h = P.PlotUtils.getAngleOfThreePoints(t[p - 1], t[p], t[p + 1]) / 2;
		l += P.PlotUtils.distance(t[p - 1], t[p]);
		var d = (i / 2 - l / n * a) / Math.sin(h),
			f = P.PlotUtils.getThirdPoint(t[p - 1], t[p], Math.PI - h, d, !0),
			E = P.PlotUtils.getThirdPoint(t[p - 1], t[p], h, d, !1);
		u.push(f), c.push(E)
	}
	return u.concat(c)
},xp.algorithm.getTempPoint4 = function(t, o, e){
	var r, n, g, i, s = P.PlotUtils.mid(t, o),
	a = P.PlotUtils.distance(s, e),
	l = P.PlotUtils.getAngleOfThreePoints(t, s, e);
	return l < P.Constants.HALF_PI ? (n = a * Math.sin(l), g = a * Math.cos(l), i = P.PlotUtils.getThirdPoint(t, s, P.Constants.HALF_PI, n, !1), r = P.PlotUtils.getThirdPoint(s, i, P.Constants.HALF_PI, g, !0)) : l >= P.Constants.HALF_PI && l < Math.PI ? (n = a * Math.sin(Math.PI - l), g = a * Math.cos(Math.PI - l), i = P.PlotUtils.getThirdPoint(t, s, P.Constants.HALF_PI, n, !1), r = P.PlotUtils.getThirdPoint(s, i, P.Constants.HALF_PI, g, !1)) : l >= Math.PI && l < 1.5 * Math.PI ? (n = a * Math.sin(l - Math.PI), g = a * Math.cos(l - Math.PI), i = P.PlotUtils.getThirdPoint(t, s, P.Constants.HALF_PI, n, !0), r = P.PlotUtils.getThirdPoint(s, i, P.Constants.HALF_PI, g, !0)) : (n = a * Math.sin(2 * Math.PI - l), g = a * Math.cos(2 * Math.PI - l), i = P.PlotUtils.getThirdPoint(t, s, P.Constants.HALF_PI, n, !0), r = P.PlotUtils.getThirdPoint(s, i, P.Constants.HALF_PI, g, !1)), r
},xp.algorithm.tailedAttackArrow = function(inputPoint){
	inputPoint = xp.algorithm.dereplication(inputPoint);
	this.tailWidthFactor = tailedAttackArrowDefualParam.tailWidthFactor;
	this.swallowTailFactor = tailedAttackArrowDefualParam.swallowTailFactor;
	this.swallowTailPnt = tailedAttackArrowDefualParam.swallowTailPnt;
	//控制点
	var result = {controlPoint:null,polygonalPoint:null};
	result.controlPoint = inputPoint;
	var t = inputPoint.length;
	if (!(2 > t)) {
		if (2 == inputPoint.length){
			result.polygonalPoint = inputPoint;
			return result;
		}
		var o = inputPoint,
			e = o[0],
			r = o[1];
		P.PlotUtils.isClockWise(o[0], o[1], o[2]) && (e = o[1], r = o[0]);
		var n = P.PlotUtils.mid(e, r),
			g = [n].concat(o.slice(2)),
			i = xp.algorithm.getAttackArrowHeadPoints(g, e, r,tailedAttackArrowDefualParam),
			s = i[0],
			a = i[4],
			l = P.PlotUtils.distance(e, r),
			u = P.PlotUtils.getBaseLength(g),
			c = u * this.tailWidthFactor * this.swallowTailFactor;
		this.swallowTailPnt = P.PlotUtils.getThirdPoint(g[1], g[0], 0, c, !0);
		var p = l / u,
			h = xp.algorithm.getAttackArrowBodyPoints(g, s, a, p),
			t = h.length,
			d = [e].concat(h.slice(0, t / 2));
		d.push(s);
		var f = [r].concat(h.slice(t / 2, t));
		var newArray = [];
		f.push(a), d = P.PlotUtils.getQBSplinePoints(d), f = P.PlotUtils.getQBSplinePoints(f),newArray = xp.algorithm.array2Dto1D(d.concat(i, f.reverse(), [this.swallowTailPnt, d[0]]));
		result.polygonalPoint = Cesium.Cartesian3.fromDegreesArray(newArray);
	}
	return result;
},xp.algorithm.getAttackArrowHeadPoints = function(t, o, e,defaultParam){
	this.headHeightFactor = defaultParam.headHeightFactor;
	this.headTailFactor = defaultParam.headTailFactor;
	this.headWidthFactor = defaultParam.headWidthFactor;
	this.neckWidthFactor = defaultParam.neckWidthFactor;
	this.neckHeightFactor = defaultParam.neckHeightFactor;
	var r = P.PlotUtils.getBaseLength(t),
		n = r * this.headHeightFactor,
		g = t[t.length - 1];
	r = P.PlotUtils.distance(g, t[t.length - 2]);
	var i = P.PlotUtils.distance(o, e);
	n > i * this.headTailFactor && (n = i * this.headTailFactor);
	var s = n * this.headWidthFactor,
		a = n * this.neckWidthFactor;
	n = n > r ? r : n;
	var l = n * this.neckHeightFactor,
		u = P.PlotUtils.getThirdPoint(t[t.length - 2], g, 0, n, !0),
		c = P.PlotUtils.getThirdPoint(t[t.length - 2], g, 0, l, !0),
		p = P.PlotUtils.getThirdPoint(g, u, P.Constants.HALF_PI, s, !1),
		h = P.PlotUtils.getThirdPoint(g, u, P.Constants.HALF_PI, s, !0),
		d = P.PlotUtils.getThirdPoint(g, c, P.Constants.HALF_PI, a, !1),
		f = P.PlotUtils.getThirdPoint(g, c, P.Constants.HALF_PI, a, !0);
	return [d, p, g, h, f]
},xp.algorithm.getAttackArrowBodyPoints = function(t, o, e, r){
	for (var n = P.PlotUtils.wholeDistance(t), g = P.PlotUtils.getBaseLength(t), i = g * r, s = P.PlotUtils.distance(o, e), a = (i - s) / 2, l = 0, u = [], c = [], p = 1; p < t.length - 1; p++) {
		var h = P.PlotUtils.getAngleOfThreePoints(t[p - 1], t[p], t[p + 1]) / 2;
		l += P.PlotUtils.distance(t[p - 1], t[p]);
		var d = (i / 2 - l / n * a) / Math.sin(h),
			f = P.PlotUtils.getThirdPoint(t[p - 1], t[p], Math.PI - h, d, !0),
			E = P.PlotUtils.getThirdPoint(t[p - 1], t[p], h, d, !1);
		u.push(f), c.push(E)
	}
	return u.concat(c)
},xp.algorithm.dereplication = function(array){
	var last = array[array.length-1];
	var change = false;
	var newArray = [];
	newArray = array.filter(function(i){
		if(i[0]!=last[0]&&i[1]!=last[1]){
			return i;
		}
		change = true;
	});
	if(change) newArray.push(last);
	return  newArray;
};

/**
 * Created by liuck
 */
(function(Cesium){
    var DrawHelper=Cesium.DrawHelper = (function () {

        // static variables
        var ellipsoid = Cesium.Ellipsoid.WGS84;

        var removeObj = {billBoard:[],primitives:[]};

        // constructor
        function _(cesiumWidget) {
            this._scene = cesiumWidget.scene;
            this._tooltip = createTooltip(cesiumWidget.container);
            this._surfaces = [];

            this.initialiseHandlers();

            this.enhancePrimitives();

        }

        _.prototype.initialiseHandlers = function () {
            var scene = this._scene;
            var _self = this;
            // scene events
            var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
            function callPrimitiveCallback(name, position) {
                if (_self._handlersMuted == true) return;
                var pickedObject = scene.pick(position);
                if (pickedObject && pickedObject.primitive && pickedObject.primitive[name]) {
                    pickedObject.primitive[name](position);
                }
            }
            handler.setInputAction(
                function (movement) {
                    callPrimitiveCallback('leftClick', movement.position);
                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
            handler.setInputAction(
                function (movement) {
                    callPrimitiveCallback('leftDoubleClick', movement.position);
                }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            var mouseOutObject;
            handler.setInputAction(
                function (movement) {
                    if (_self._handlersMuted == true) return;
                    var pickedObject = scene.pick(movement.endPosition);
                    if (mouseOutObject && (!pickedObject || mouseOutObject != pickedObject.primitive)) {
                        !(mouseOutObject.isDestroyed && mouseOutObject.isDestroyed()) && mouseOutObject.mouseOut(movement.endPosition);
                        mouseOutObject = null;
                    }
                    if (pickedObject && pickedObject.primitive) {
                        pickedObject = pickedObject.primitive;
                        if (pickedObject.mouseOut) {
                            mouseOutObject = pickedObject;
                        }
                        if (pickedObject.mouseMove) {
                            pickedObject.mouseMove(movement.endPosition);
                        }
                    }
                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            handler.setInputAction(
                function (movement) {
                    callPrimitiveCallback('leftUp', movement.position);
                }, Cesium.ScreenSpaceEventType.LEFT_UP);
            handler.setInputAction(
                function (movement) {
                    callPrimitiveCallback('leftDown', movement.position);
                }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        }

        _.prototype.setListener = function (primitive, type, callback) {
            primitive[type] = callback;
        }

        _.prototype.muteHandlers = function (muted) {
            this._handlersMuted = muted;
        }

        // register event handling for an editable shape
        // shape should implement setEditMode and setHighlighted
        _.prototype.registerEditableShape = function (surface) {
            var _self = this;

            // handlers for interactions
            // highlight polygon when mouse is entering
            setListener(surface, 'mouseMove', function (position) {
                surface.setHighlighted(true);
                if (!surface._editMode) {
                    _self._tooltip.showAt(position, "点击以编辑图形");
                }
            });
            // hide the highlighting when mouse is leaving the polygon
            setListener(surface, 'mouseOut', function (position) {
                surface.setHighlighted(false);
                _self._tooltip.setVisible(false);
            });
            setListener(surface, 'leftClick', function (position) {
                surface.setEditMode(true);
                removeObj.primitives.push(surface);
            });

            setListener(surface,'leftDoubleClick',function(position){
                  //var logging = document.getElementById('loggingText');
                  //logging.innerHTML = "可删除";
                  removeObj.primitives.push(surface);
            })
        }

        _.prototype.startDrawing = function (cleanUp) {
            // undo any current edit of shapes
            this.disableAllEditMode();
            // check for cleanUp first
            if (this.editCleanUp) {
                this.editCleanUp();
            }
            this.editCleanUp = cleanUp;
            this.muteHandlers(true);
        }

        _.prototype.stopDrawing = function () {
            // check for cleanUp first
            if (this.editCleanUp) {
                this.editCleanUp();
                this.editCleanUp = null;
            }
            this.muteHandlers(false);
        }

        // make sure only one shape is highlighted at a time
        _.prototype.disableAllHighlights = function () {
            this.setHighlighted(undefined);
        }

        _.prototype.setHighlighted = function (surface) {
            if (this._highlightedSurface && !this._highlightedSurface.isDestroyed() && this._highlightedSurface != surface) {
                this._highlightedSurface.setHighlighted(false);
            }
            this._highlightedSurface = surface;
        }

        _.prototype.disableAllEditMode = function () {
            this.setEdited(undefined);
        }

        _.prototype.setEdited = function (surface) {
            if (this._editedSurface && !this._editedSurface.isDestroyed()) {
                this._editedSurface.setEditMode(false);
            }
            this._editedSurface = surface;
        }

        var material = Cesium.Material.fromType(Cesium.Material.ColorType);
        material.uniforms.color = new Cesium.Color(1.0, 1.0, 0.0, 0.5);

        var defaultShapeOptions = {
            ellipsoid: Cesium.Ellipsoid.WGS84,
            textureRotationAngle: 0.0,
            height: 0.0,
            asynchronous: true,
            show: true,
            debugShowBoundingVolume: false
        }

        var defaultSurfaceOptions = copyOptions(defaultShapeOptions, {
            appearance: new Cesium.EllipsoidSurfaceAppearance({
                aboveGround: false
            }),
            material: material,
            granularity: Math.PI / 180.0
        });

        var defaultPolygonOptions = copyOptions(defaultShapeOptions, {});
        var defaultExtentOptions = copyOptions(defaultShapeOptions, {});
        var defaultCircleOptions = copyOptions(defaultShapeOptions, {});
        var defaultEllipseOptions = copyOptions(defaultSurfaceOptions, { rotation: 0 });

        var defaultPolylineOptions = copyOptions(defaultShapeOptions, {
            width: 5,
            geodesic: true,
            granularity: 10000,
            appearance: new Cesium.PolylineMaterialAppearance({
                aboveGround: false
            }),
            material: material
        });

        //    Cesium.Polygon.prototype.setStrokeStyle = setStrokeStyle;
        //
        //    Cesium.Polygon.prototype.drawOutline = drawOutline;
        //

        var ChangeablePrimitive = (function () {
            function _() {
            }

            _.prototype.initialiseOptions = function (options) {

                fillOptions(this, options);

                this._ellipsoid = undefined;
                this._granularity = undefined;
                this._height = undefined;
                this._textureRotationAngle = undefined;
                this._id = undefined;

                // set the flags to initiate a first drawing
                this._createPrimitive = true;
                this._primitive = undefined;
                this._outlinePolygon = undefined;

            }

            _.prototype.setAttribute = function (name, value) {
                this[name] = value;
                this._createPrimitive = true;
            };

            _.prototype.getAttribute = function (name) {
                return this[name];
            };

            /**
             * @private
             */
            _.prototype.update = function (context, frameState, commandList) {

                if (!Cesium.defined(this.ellipsoid)) {
                    throw new Cesium.DeveloperError('this.ellipsoid must be defined.');
                }

                if (!Cesium.defined(this.appearance)) {
                    throw new Cesium.DeveloperError('this.material must be defined.');
                }

                if (this.granularity < 0.0) {
                    throw new Cesium.DeveloperError('this.granularity and scene2D/scene3D overrides must be greater than zero.');
                }

                if (!this.show) {
                    return;
                }

                if (!this._createPrimitive && (!Cesium.defined(this._primitive))) {
                    // No positions/hierarchy to draw
                    return;
                }

                if (this._createPrimitive ||
                    (this._ellipsoid !== this.ellipsoid) ||
                    (this._granularity !== this.granularity) ||
                    (this._height !== this.height) ||
                    (this._textureRotationAngle !== this.textureRotationAngle) ||
                    (this._id !== this.id)) {

                    var geometry = this.getGeometry();
                    if (!geometry) {
                        return;
                    }

                    this._createPrimitive = false;
                    this._ellipsoid = this.ellipsoid;
                    this._granularity = this.granularity;
                    this._height = this.height;
                    this._textureRotationAngle = this.textureRotationAngle;
                    this._id = this.id;

                    this._primitive = this._primitive && this._primitive.destroy();

                    this._primitive = new Cesium.Primitive({
                        geometryInstances: new Cesium.GeometryInstance({
                            geometry: geometry,
                            id: this.id,
                            pickPrimitive: this
                        }),
                        appearance: this.appearance,
                        asynchronous: this.asynchronous
                    });

                    this._outlinePolygon = this._outlinePolygon && this._outlinePolygon.destroy();
                    if (this.strokeColor && this.getOutlineGeometry) {
                        // create the highlighting frame
                        this._outlinePolygon = new Cesium.Primitive({
                            geometryInstances: new Cesium.GeometryInstance({
                                geometry: this.getOutlineGeometry(),
                                attributes: {
                                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(this.strokeColor)
                                }
                            }),
                            appearance: new Cesium.PerInstanceColorAppearance({
                                flat: true,
                                renderState: {
                                    depthTest: {
                                        enabled: true
                                    },
                                    lineWidth: 1.0
                                }
                            })
                        });
                    }
                }

                var primitive = this._primitive;
                primitive.appearance.material = this.material;
                primitive.debugShowBoundingVolume = this.debugShowBoundingVolume;
                primitive.update(context, frameState, commandList);
                this._outlinePolygon && this._outlinePolygon.update(context, frameState, commandList);

            };

            _.prototype.isDestroyed = function () {
                return false;
            };

            _.prototype.destroy = function () {
                this._primitive = this._primitive && this._primitive.destroy();
                return Cesium.destroyObject(this);
            };

            _.prototype.setStrokeStyle = function (strokeColor, strokeWidth) {
                if (!this.strokeColor || !this.strokeColor.equals(strokeColor) || this.strokeWidth != strokeWidth) {
                    this._createPrimitive = true;
                    this.strokeColor = strokeColor;
                    this.strokeWidth = strokeWidth;
                }
            }
            return _;
        })();

        _.ExtentPrimitive = (function () {
            function _(options) {

                if (!Cesium.defined(options.extent)) {
                    throw new Cesium.DeveloperError('Extent is required');
                }

                options = copyOptions(options, defaultSurfaceOptions);

                this.initialiseOptions(options);

                this.setExtent(options.extent);

            }

            _.prototype = new ChangeablePrimitive();

            _.prototype.setExtent = function (extent) {
                this.setAttribute('extent', extent);
            };

            _.prototype.getExtent = function () {
                return this.getAttribute('extent');
            };

            _.prototype.getGeometry = function () {

                if (!Cesium.defined(this.extent)) {
                    return;
                }

                return Cesium.PolygonGeometry.fromPositions({
                    positions: this.extent,
                    height: this.height,
                    vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                    stRotation: this.textureRotationAngle,
                    ellipsoid: this.ellipsoid,
                    granularity: this.granularity
                });

            };

            _.prototype.getOutlineGeometry = function () {
                 return Cesium.PolygonOutlineGeometry.fromPositions({
                    positions: this.extent
               });
            }

            return _;
        })();

        _.PolygonPrimitive = (function () {

            function _(options) {

                options = copyOptions(options, defaultSurfaceOptions);
                this.initialiseOptions(options);

                this.isPolygon = true;

            }
            _.prototype = new ChangeablePrimitive();

            _.prototype.setPositions = function (positions) {
                this.setAttribute('positions', positions);
            };

            _.prototype.getPositions = function () {
                return this.getAttribute('positions');
            };

            _.prototype.setCustom = function(custom){
                this.setAttribute('custom');
            }

            _.prototype.getCustom = function(custom){
                return this.getAttribute('custom');
            }

            _.prototype.getGeometry = function () {

                if (!Cesium.defined(this.positions) || this.positions.length < 3) {
                    return;
                }
                return Cesium.PolygonGeometry.fromPositions({
                    positions: this.positions,
                    height: this.height,
                    vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                    stRotation: this.textureRotationAngle,
                    ellipsoid: this.ellipsoid,
                    granularity: this.granularity
                });
            };

            _.prototype.getOutlineGeometry = function () {
                return Cesium.PolygonOutlineGeometry.fromPositions({
                    positions: this.getPositions()
                });
            }

            return _;
        })();

        _.TailedAttackPrimitive = (function () {

            function _(options) {

                options = copyOptions(options, defaultSurfaceOptions);
                this.initialiseOptions(options);

                this.isPolygon = true;

            }
            _.prototype = new ChangeablePrimitive();

            _.prototype.setPositions = function (positions) {
                this.setAttribute('positions', positions);
            };

            _.prototype.getPositions = function () {
                return this.getAttribute('positions');
            };

            _.prototype.setCustom = function(custom){
                this.setAttribute('custom');
            }

            _.prototype.getCustom = function(custom){
                return this.getAttribute('custom');
            }

            _.prototype.getGeometry = function () {

                if (!Cesium.defined(this.positions) || this.positions.length < 3) {
                    return;
                }
                return Cesium.PolygonGeometry.fromPositions({
                    positions: this.positions,
                    height: this.height,
                    vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                    stRotation: this.textureRotationAngle,
                    ellipsoid: this.ellipsoid,
                    granularity: this.granularity
                });
            };

            _.prototype.getOutlineGeometry = function () {
                return Cesium.PolygonOutlineGeometry.fromPositions({
                    positions: this.getPositions()
                });
            }

            return _;
        })();

        _.PolylinePrimitive = (function () {

            function _(options) {

                options = copyOptions(options, defaultPolylineOptions);

                this.initialiseOptions(options);

            }

            _.prototype = new ChangeablePrimitive();

            _.prototype.setPositions = function (positions) {
                this.setAttribute('positions', positions);
            };

            _.prototype.setWidth = function (width) {
                this.setAttribute('width', width);
            };

            _.prototype.setGeodesic = function (geodesic) {
                this.setAttribute('geodesic', geodesic);
            };

            _.prototype.getPositions = function () {
                return this.getAttribute('positions');
            };

            _.prototype.getWidth = function () {
                return this.getAttribute('width');
            };

            _.prototype.getGeodesic = function (geodesic) {
                return this.getAttribute('geodesic');
            };

            _.prototype.getGeometry = function () {

                if (!Cesium.defined(this.positions) || this.positions.length < 2) {
                    return;
                }

                return new Cesium.PolylineGeometry({
                    positions: this.positions,
                    height: this.height,
                    width: this.width < 1 ? 1 : this.width,
                    vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                    ellipsoid: this.ellipsoid
                });
            }

            return _;
        })();

        var defaultBillboard = {
            iconUrl: "/geomap-api/JsCesuimDemo/resource/images/img_plot/dragIcon.png",

            shiftX: 0,
            shiftY: 0
        }

        var dragBillboard = {
            iconUrl: "/geomap-api/JsCesuimDemo/resource/images/img_plot/dragIcon.png",
            shiftX: 0,
            shiftY: 0
        }

        var dragHalfBillboard = {
            iconUrl: "/geomap-api/JsCesuimDemo/resource/images/img_plot/dragIconLight.png",
            shiftX: 0,
            shiftY: 0
        }

        _.prototype.createBillboardGroup = function (points, options, callbacks) {
            var markers = new _.BillboardGroup(this, options);
            markers.addBillboards(points, callbacks);
            return markers;
        }

        _.BillboardGroup = function (drawHelper, options) {

            this._drawHelper = drawHelper;
            this._scene = drawHelper._scene;

            this._options = copyOptions(options, defaultBillboard);

            // create one common billboard collection for all billboards
            var b = new Cesium.BillboardCollection();
            this._scene.primitives.add(b);
            this._billboards = b;
            // keep an ordered list of billboards
            this._orderedBillboards = [];
        }

        _.BillboardGroup.prototype.createBillboard = function (position, callbacks) {

            var billboard = this._billboards.add({
                show: true,
                position: position,
                pixelOffset: new Cesium.Cartesian2(this._options.shiftX, this._options.shiftY),
                eyeOffset: new Cesium.Cartesian3(0.0, 0.0, 0.0),
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                scale: 1.0,
                image: this._options.iconUrl,
                color: new Cesium.Color(1.0, 1.0, 1.0, 1.0)
            });

            // if editable
            if (callbacks) {
                var _self = this;
                var screenSpaceCameraController = this._scene.screenSpaceCameraController;
                function enableRotation(enable) {
                    screenSpaceCameraController.enableRotate = enable;
                }
                function getIndex() {
                    // find index
                    for (var i = 0, I = _self._orderedBillboards.length; i < I && _self._orderedBillboards[i] != billboard; ++i);
                    return i;
                }
                if (callbacks.dragHandlers) {
                    var _self = this;
                    setListener(billboard, 'leftDown', function (position) {
                        // TODO - start the drag handlers here
                        // create handlers for mouseOut and leftUp for the billboard and a mouseMove
                        function onDrag(position) {
                            billboard.position = position;
                            // find index
                            for (var i = 0, I = _self._orderedBillboards.length; i < I && _self._orderedBillboards[i] != billboard; ++i);
                            callbacks.dragHandlers.onDrag && callbacks.dragHandlers.onDrag(getIndex(), position);
                        }
                        function onDragEnd(position) {
                            handler.destroy();
                            enableRotation(true);
                            callbacks.dragHandlers.onDragEnd && callbacks.dragHandlers.onDragEnd(getIndex(), position);
                        }

                        var handler = new Cesium.ScreenSpaceEventHandler(_self._scene.canvas);

                        handler.setInputAction(function (movement) {
                            var cartesian = _self._scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                            if (cartesian) {
                                onDrag(cartesian);
                            } else {
                                onDragEnd(cartesian);
                            }
                        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                        handler.setInputAction(function (movement) {
                            onDragEnd(_self._scene.camera.pickEllipsoid(movement.position, ellipsoid));
                        }, Cesium.ScreenSpaceEventType.LEFT_UP);

                        enableRotation(false);

                        callbacks.dragHandlers.onDragStart && callbacks.dragHandlers.onDragStart(getIndex(), _self._scene.camera.pickEllipsoid(position, ellipsoid));
                    });
                }
                if (callbacks.onDoubleClick) {
                    setListener(billboard, 'leftDoubleClick', function (position) {
                        callbacks.onDoubleClick(getIndex());
                    });
                }
                if (callbacks.onClick) {
                    setListener(billboard, 'leftClick', function (position) {
                        callbacks.onClick(getIndex());
                    });
                }
                if (callbacks.tooltip) {
                    setListener(billboard, 'mouseMove', function (position) {
                        _self._drawHelper._tooltip.showAt(position, callbacks.tooltip());
                    });
                    setListener(billboard, 'mouseOut', function (position) {
                        _self._drawHelper._tooltip.setVisible(false);
                    });
                }
            }

            return billboard;
        }

        _.BillboardGroup.prototype.insertBillboard = function (index, position, callbacks) {
            this._orderedBillboards.splice(index, 0, this.createBillboard(position, callbacks));
        }

        _.BillboardGroup.prototype.addBillboard = function (position, callbacks) {
            this._orderedBillboards.push(this.createBillboard(position, callbacks));
        }

        _.BillboardGroup.prototype.removeLastBillboard = function () {
            this._billboards.remove(this._orderedBillboards.pop());
        }

        _.BillboardGroup.prototype.addBillboards = function (positions, callbacks) {
            var index = 0;
            for (; index < positions.length; index++) {
                this.addBillboard(positions[index], callbacks);
            }
        }

        _.BillboardGroup.prototype.updateBillboardsPositions = function (positions) {
            var index = 0;
            for (; index < positions.length; index++) {
                this.getBillboard(index).position = positions[index];
            }
        }

        _.BillboardGroup.prototype.countBillboards = function () {
            return this._orderedBillboards.length;
        }

        _.BillboardGroup.prototype.getBillboard = function (index) {
            return this._orderedBillboards[index];
        }

        _.BillboardGroup.prototype.removeBillboard = function (index) {
            this._billboards.remove(this.getBillboard(index));
            this._orderedBillboards.splice(index, 1);
        }

        _.BillboardGroup.prototype.remove = function () {
            this._billboards = this._billboards && this._billboards.removeAll() && this._billboards.destroy();
        }

        _.BillboardGroup.prototype.setOnTop = function () {
            this._scene.primitives.raiseToTop(this._billboards);
        }

        _.prototype.startDrawingPolygon = function (options) {
            var options = copyOptions(options, defaultSurfaceOptions);
            this.startDrawingPolyshape(true, options);
        }

        _.prototype.startDrawingPolyline = function (options) {
            var options = copyOptions(options, defaultPolylineOptions);
            var isPolygon = false;

            this.startDrawing(
                function () {
                    primitives.remove(poly);
                    markers.remove();
                    mouseHandler.destroy();
                    tooltip.setVisible(false);
                }
            );

            var _self = this;
            var scene = this._scene;
            var primitives = scene.primitives;
            var tooltip = this._tooltip;

            var minPoints = isPolygon ? 3 : 2;
            var poly;
            if (isPolygon) {
                poly = new DrawHelper.PolygonPrimitive(options);
            } else {
                poly = new DrawHelper.PolylinePrimitive(options);
            }
            poly.asynchronous = false;
            primitives.add(poly);

            var positions = [];
            var markers = new _.BillboardGroup(this, defaultBillboard);

            var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

            // Now wait for start
            mouseHandler.setInputAction(function (movement) {
                if (movement.position != null) {
                    var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                    if (cartesian) {
                        // first click
                        if (positions.length == 0) {
                            positions.push(cartesian.clone());
                            markers.addBillboard(positions[0]);
                        }
                        if (positions.length >= minPoints) {
                            poly.positions = positions;
                            poly._createPrimitive = true;
                        }
                        // add new point to polygon
                        // this one will move with the mouse
                        positions.push(cartesian);
                        // add marker at the new position
                        markers.addBillboard(cartesian);
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

            mouseHandler.setInputAction(function (movement) {
                var position = movement.endPosition;
                if (position != null) {
                    if (positions.length == 0) {
                        tooltip.showAt(position, "<p>Click to add first point</p>");
                    } else {
                        var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                        if (cartesian) {
                            positions.pop();
                            // make sure it is slightly different
                            cartesian.y += (1 + Math.random());
                            positions.push(cartesian);
                            if (positions.length >= minPoints) {
                                poly.positions = positions;
                                poly._createPrimitive = true;
                            }
                            // update marker
                            markers.getBillboard(positions.length - 1).position = cartesian;
                            // show tooltip
                            tooltip.showAt(position, "<p>Click to add new point (" + positions.length + ")</p>" + (positions.length > minPoints ? "<p>Double click to finish drawing</p>" : ""));
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

            mouseHandler.setInputAction(function (movement) {
                var position = movement.position;
                if (position != null) {
                    if (positions.length < minPoints + 2) {
                        return;
                    } else {
                        var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                        if (cartesian) {
                            _self.stopDrawing();
                            if (typeof options.callback == 'function') {
                                // remove overlapping ones
                                var index = positions.length - 1;
                                options.callback(positions);
                            }
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
        /*
         * _.prototype.startDrawingPolyline = function (options) {
            var options = copyOptions(options, defaultPolylineOptions);
            this.startDrawingPolyshape(false, options);
            }
         */

        function getExtentCorners(value) {
            return ellipsoid.cartographicArrayToCartesianArray([Cesium.Rectangle.northwest(value), Cesium.Rectangle.northeast(value), Cesium.Rectangle.southeast(value), Cesium.Rectangle.southwest(value)]);
        }

        function getArrowCorners(value){
            return [value[7],value[3]];
        }

        _.prototype.startDrawingTailedAttack = function (options) {

            this.startDrawing(
                function () {
                    primitives.remove(poly);
                    markers.remove();
                    mouseHandler.destroy();
                    tooltip.setVisible(false);
                }
            );
            this.firstTime=true;
            this.options=options;
            var _self = this;
            var scene = this._scene;
            var primitives = scene.primitives;
            var tooltip = this._tooltip;

            var minPoints = 2;
            var poly = new DrawHelper.TailedAttackPrimitive(options);
            if(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent)){
                poly.asynchronous = true;
            }else{
                poly.asynchronous = false;
            }
            primitives.add(poly);

            var positions = [];
            var inputPositions = [];
            var markers = new _.BillboardGroup(this, defaultBillboard);

            var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
            this.positions=positions;
            this.minPoints=minPoints;
            this.poly=poly;
            // Now wait for start
            mouseHandler.setInputAction(function (movement) {
                if (movement.position != null) {
                    var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                    var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                    var len=Cesium.Math.toDegrees(cartographic.longitude);
                    var lat=Cesium.Math.toDegrees(cartographic.latitude);
                    var point = [len,lat];
                    if (cartesian) {
                        // first click
                        if (inputPositions.length == 0) {
                            positions.push(cartesian.clone());
                            markers.addBillboard(positions[0]);
                        }
                        if(inputPositions.length <3){
                            inputPositions.push(point);
                        }
                        if (inputPositions.length >= minPoints ) {
                            //应该是在此改变多边形的点位  positions
                            inputPositions.push(point);
                            var doubleArrowResult = xp.algorithm.tailedAttackArrow(inputPositions);
                            poly.positions = doubleArrowResult.polygonalPoint//positions
                            poly.custom =doubleArrowResult.controlPoint;
                            poly._createPrimitive = true;
                        }
                        positions.push(cartesian);
                        // add marker at the new position
                        if(positions.length>=5){
                            markers.removeLastBillboard();
                        }
                        markers.addBillboard(cartesian);
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

            mouseHandler.setInputAction(function (movement) {
                var position = movement.endPosition;
                if (position != null) {
                    if (positions.length == 0) {
                        tooltip.showAt(position, "<p>点击以增加第一个控制点</p>");
                    } else {
                        var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                        var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                        var len=Cesium.Math.toDegrees(cartographic.longitude);
                        var lat=Cesium.Math.toDegrees(cartographic.latitude);
                        var point = [len,lat];
                        if (cartesian) {
                            positions.pop();
                            // make sure it is slightly different
                            cartesian.y += (1 + Math.random());
                            positions.push(cartesian);
                            if(inputPositions.length>=3){
                                inputPositions.pop();
                                inputPositions.push(point);
                            }
                            if(inputPositions.length==2){
                                inputPositions.push(point);
                            }
                            if (positions.length > minPoints) {
                                //在此改变多边形点位
                                var doubleArrowResult = xp.algorithm.tailedAttackArrow(inputPositions);
                                poly.positions = doubleArrowResult?doubleArrowResult.polygonalPoint:null;//positions
                                poly.custom =doubleArrowResult?doubleArrowResult.controlPoint:null;
                                poly._createPrimitive = true;
                            }
                            var str = positions.length==3?"<p>双击可结束绘制</p>":"单击以增加一个新的控制点";
                            tooltip.showAt(position, str);
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

            mouseHandler.setInputAction(function (movement) {
                _self.drawEnd(movement,options);
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        };
        _.prototype.drawEnd=function(movement,options){
            var position;
            var positions=this.positions;
            var minPoints=this.minPoints;
            var poly=this.poly;
            var options=this.options;
            if(movement==undefined){
                if(this.firstTime){
                    this.stopDrawing();
                    if (typeof options.callback == 'function') {
                        // remove overlapping ones
                        var index = positions.length - 1;
                        //options.callback(positions);
                        options.callback(poly.positions,poly.custom);
                         this.firstTime=false;
                }else{
                        return;
                    }
                }
            }else{
                position = movement.position;
                if (position != null) {
                    if (positions.length < minPoints + 2) {
                        return;
                    } else {
                        var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                        if (cartesian) {
                            this.stopDrawing();
                            if (typeof options.callback == 'function') {
                                // remove overlapping ones
                                var index = positions.length - 1;
                                //options.callback(positions);
                                options.callback(poly.positions,poly.custom);
                            }
                        }
                    }
                }
            }
        }

        _.prototype.startDrawingPolyshape = function (isPolygon, options) {

            this.startDrawing(
                function () {
                    primitives.remove(poly);
                    markers.remove();
                    mouseHandler.destroy();
                    tooltip.setVisible(false);
                }
            );
            this.firstTime=true;
            this.options=options;
            var _self = this;
            var scene = this._scene;
            var primitives = scene.primitives;
            var tooltip = this._tooltip;

            var minPoints = isPolygon ? 2 : 2;
            this.minPoints=minPoints;
            var poly;
            if (isPolygon) {
                poly = new DrawHelper.PolygonPrimitive(options);
            } else {
                poly = new DrawHelper.PolylinePrimitive(options);
            }
            if(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent)){
                poly.asynchronous = true;
            }else{
                poly.asynchronous = false;
            }

            primitives.add(poly);


            var positions = [];
            var inputPositions = [];
            var markers = new _.BillboardGroup(this, defaultBillboard);

            var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
            this.poly=poly;
            this.positions=positions;
            // Now wait for start
            mouseHandler.setInputAction(function (movement) {
                if (movement.position != null) {
                    var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                    var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                    var len=Cesium.Math.toDegrees(cartographic.longitude);
                    var lat=Cesium.Math.toDegrees(cartographic.latitude);
                    var point = [len,lat];
                    if (cartesian) {
                        // first click
                        if (inputPositions.length == 0) {
                            positions.push(cartesian.clone());
                            markers.addBillboard(positions[0]);
                        }
                        if(inputPositions.length <3){
                            inputPositions.push(point);
                        }
                        if (inputPositions.length >= minPoints) {
                            //应该是在此改变多边形的点位  positions
                            var doubleArrowResult = xp.algorithm.doubleArrow(inputPositions);
                            poly.positions = doubleArrowResult.polygonalPoint//positions
                            poly.custom =doubleArrowResult.controlPoint;
                            poly._createPrimitive = true;
                        }
                        positions.push(cartesian);
                        // add marker at the new position
                        if(positions.length>=5){
                            markers.removeLastBillboard();
                        }
                        markers.addBillboard(cartesian);
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

            mouseHandler.setInputAction(function (movement) {
                var position = movement.endPosition;
                if (position != null) {
                    if (positions.length == 0) {
                        tooltip.showAt(position, "<p>点击以增加第一个控制点</p>");
                    } else {
                        var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                        var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                        var len=Cesium.Math.toDegrees(cartographic.longitude);
                        var lat=Cesium.Math.toDegrees(cartographic.latitude);
                        var point = [len,lat];
                        if (cartesian) {
                            positions.pop();
                            // make sure it is slightly different
                            cartesian.y += (1 + Math.random());
                            positions.push(cartesian);
                            if(inputPositions.length==3){
                                inputPositions.pop();
                                inputPositions.push(point);
                            }
                            if(inputPositions.length==2){
                                inputPositions.push(point);
                            }
                            if (positions.length >= minPoints) {
                                //在此改变多边形点位
                                var doubleArrowResult = xp.algorithm.doubleArrow(inputPositions);
                                poly.positions = doubleArrowResult?doubleArrowResult.polygonalPoint:null;//positions
                                poly.custom =doubleArrowResult?doubleArrowResult.controlPoint:null;
                                poly._createPrimitive = true;
                            }
                            // update marker
                            // show tooltip
                            var str = positions.length==3?"<p>双击可结束绘制</p>":"单击以增加一个新的控制点";
                            tooltip.showAt(position, str);
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

            mouseHandler.setInputAction(function (movement) {
                _self.drawEnd(movement,options);
                //var position = movement.position;
                //if (position != null) {
                //    if (positions.length < minPoints + 2) {
                //        return;
                //    } else {
                //        var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                //        if (cartesian) {
                //            _self.stopDrawing();
                //            if (typeof options.callback == 'function') {
                //                // remove overlapping ones
                //                var index = positions.length - 1;
                //                //options.callback(positions);
                //                options.callback(poly.positions,poly.custom);
                //            }
                //        }
                //    }
                //}
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }

        _.prototype.startDrawingExtent = function (options) {

            var options = copyOptions(options, defaultSurfaceOptions);

            this.startDrawing(
                function () {
                    if (extent != null) {
                        primitives.remove(extent);
                    }
                    markers.remove();
                    mouseHandler.destroy();
                    tooltip.setVisible(false);
                }
            );

            var _self = this;
            var scene = this._scene;
            var primitives = this._scene.primitives;
            var tooltip = this._tooltip;

            var firstPoint = [];
            var extent = null;
            var markers = null;

            var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

            // Now wait for start
            mouseHandler.setInputAction(function (movement) {
                if (movement.position != null) {
                    var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                    if (cartesian) {
                        if (extent == null) {
                            // create the rectangle
                            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                            var len=Cesium.Math.toDegrees(cartographic.longitude);
                            var lat=Cesium.Math.toDegrees(cartographic.latitude);
                            firstPoint.push(len,lat);
                            var value = fineArrow(firstPoint, firstPoint);
                            extent = new _.ExtentPrimitive({
                                extent: value,
                                asynchronous: false,
                                material: options.material
                            });

                            primitives.add(extent);
                            markers = new _.BillboardGroup(_self, defaultBillboard);
                            var corners = positionToCartesian3([firstPoint,firstPoint]);
                            markers.addBillboards(corners);
                        } else {
                            _self.stopDrawing();
                            if (typeof options.callback == 'function') {
                                 var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                                 var len=Cesium.Math.toDegrees(cartographic.longitude);
                                 var lat=Cesium.Math.toDegrees(cartographic.latitude);
                                 options.callback(fineArrow(firstPoint,[len,lat]));
                            }
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

            mouseHandler.setInputAction(function (movement) {
                var position = movement.endPosition;
                if (position != null) {
                    if (extent == null) {
                        tooltip.showAt(position, "<p>点击开始绘制</p>");
                    } else {
                        var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                        if (cartesian) {
                            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                            var len=Cesium.Math.toDegrees(cartographic.longitude);
                            var lat=Cesium.Math.toDegrees(cartographic.latitude);
                            var value = fineArrow(firstPoint,[len,lat]);
                            extent.setExtent(value);
                           // var corners = getExtentCorners(value);
                            var corners =  positionToCartesian3([firstPoint,[len,lat]]);
                            markers.updateBillboardsPositions(corners);
                            tooltip.showAt(position, "<p>拖动改变箭头</p><p>再次点击结束绘制</p>");
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        }

        _.prototype.enhancePrimitives = function () {

            var drawHelper = this;

            Cesium.Billboard.prototype.setEditable = function () {

                if (this._editable) {
                    return;
                }

                this._editable = true;

                var billboard = this;

                var _self = this;

                function enableRotation(enable) {
                    drawHelper._scene.screenSpaceCameraController.enableRotate = enable;
                }

                setListener(billboard, 'leftDown', function (position) {
                    // TODO - start the drag handlers here
                    // create handlers for mouseOut and leftUp for the billboard and a mouseMove
                    function onDrag(position) {
                        billboard.position = position;
                        _self.executeListeners({ name: 'drag', positions: position });
                    }
                    function onDragEnd(position) {
                        handler.destroy();
                        enableRotation(true);
                        _self.executeListeners({ name: 'dragEnd', positions: position });
                    }

                    var handler = new Cesium.ScreenSpaceEventHandler(drawHelper._scene.canvas);

                    handler.setInputAction(function (movement) {
                        var cartesian = drawHelper._scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                        if (cartesian) {
                            onDrag(cartesian);
                        } else {
                            onDragEnd(cartesian);
                        }
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                    handler.setInputAction(function (movement) {
                        onDragEnd(drawHelper._scene.camera.pickEllipsoid(movement.position, ellipsoid));
                    }, Cesium.ScreenSpaceEventType.LEFT_UP);

                    enableRotation(false);

                });

                enhanceWithListeners(billboard);

            }

            function setHighlighted(highlighted) {

                var scene = drawHelper._scene;

                // if no change
                // if already highlighted, the outline polygon will be available
                if (this._highlighted && this._highlighted == highlighted) {
                    return;
                }
                // disable if already in edit mode
                if (this._editMode === true) {
                    return;
                }
                this._highlighted = highlighted;
                // highlight by creating an outline polygon matching the polygon points
                if (highlighted) {
                    // make sure all other shapes are not highlighted
                    drawHelper.setHighlighted(this);
                    this._strokeColor = this.strokeColor;
                    this.setStrokeStyle(Cesium.Color.fromCssColorString('white'), this.strokeWidth);
                } else {
                    if (this._strokeColor) {
                        this.setStrokeStyle(this._strokeColor, this.strokeWidth);
                    } else {
                        this.setStrokeStyle(undefined, undefined);
                    }
                }
            }

            function setEditMode(editMode) {
                // if no change
                if (this._editMode == editMode) {
                    return;
                }
                // make sure all other shapes are not in edit mode before starting the editing of this shape
                drawHelper.disableAllHighlights();
                // display markers
                if (editMode) {
                    drawHelper.setEdited(this);
                    var scene = drawHelper._scene;
                    var _self = this;
                    // create the markers and handlers for the editing
                    if (this._markers == null) {
                        var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                        removeObj.billBoard.push(markers);
                        var editMarkers = new _.BillboardGroup(drawHelper, dragHalfBillboard);
                        removeObj.billBoard.push(editMarkers);
                        // function for updating the edit markers around a certain point
                        function updateHalfMarkers(index, positions) {
                            // update the half markers before and after the index
                            var editIndex = index - 1 < 0 ? positions.length - 1 : index - 1;
                            if (editIndex < editMarkers.countBillboards()) {
                                editMarkers.getBillboard(editIndex).position = calculateHalfMarkerPosition(editIndex);
                            }
                            editIndex = index;
                            if (editIndex < editMarkers.countBillboards()) {
                                editMarkers.getBillboard(editIndex).position = calculateHalfMarkerPosition(editIndex);
                            }
                        }
                        function onEdited() {
                            _self.executeListeners({ name: 'onEdited', positions: _self.positions });
                        }
                        var handleMarkerChanges = {
                            dragHandlers: {
                                onDrag: function (index, position) {
                                    _self.positions[index] = position;
                                    updateHalfMarkers(index, _self.positions);
                                    _self._createPrimitive = true;
                                },
                                onDragEnd: function (index, position) {
                                    _self._createPrimitive = true;
                                    onEdited();
                                }
                            },
                            onDoubleClick: function (index) {
                                if (_self.positions.length < 4) {
                                    return;
                                }
                                // remove the point and the corresponding markers
                                _self.positions.splice(index, 1);
                                _self._createPrimitive = true;
                                markers.removeBillboard(index);
                                editMarkers.removeBillboard(index);
                                updateHalfMarkers(index, _self.positions);
                                onEdited();
                            },
                            tooltip: function () {
                                if (_self.positions.length > 3) {
                                    return "Double click to remove this point";
                                }
                            }
                        };
                        // add billboards and keep an ordered list of them for the polygon edges
                        markers.addBillboards(_self.positions, handleMarkerChanges);
                        this._markers = markers;
                        function calculateHalfMarkerPosition(index) {
                            var positions = _self.positions;
                            return ellipsoid.cartographicToCartesian(
                                new Cesium.EllipsoidGeodesic(ellipsoid.cartesianToCartographic(positions[index]),
                                    ellipsoid.cartesianToCartographic(positions[index < positions.length - 1 ? index + 1 : 0])).
                                    interpolateUsingFraction(0.5)
                            );
                        }
                        var halfPositions = [];
                        var index = 0;
                        var length = _self.positions.length + (this.isPolygon ? 0 : -1);
                        for (; index < length; index++) {
                            halfPositions.push(calculateHalfMarkerPosition(index));
                        }
                        var handleEditMarkerChanges = {
                            dragHandlers: {
                                onDragStart: function (index, position) {
                                    // add a new position to the polygon but not a new marker yet
                                    this.index = index + 1;
                                    _self.positions.splice(this.index, 0, position);
                                    _self._createPrimitive = true;
                                },
                                onDrag: function (index, position) {
                                    _self.positions[this.index] = position;
                                    _self._createPrimitive = true;
                                },
                                onDragEnd: function (index, position) {
                                    // create new sets of makers for editing
                                    markers.insertBillboard(this.index, position, handleMarkerChanges);
                                    editMarkers.getBillboard(this.index - 1).position = calculateHalfMarkerPosition(this.index - 1);
                                    editMarkers.insertBillboard(this.index, calculateHalfMarkerPosition(this.index), handleEditMarkerChanges);
                                    _self._createPrimitive = true;
                                    onEdited();
                                }
                            },
                            tooltip: function () {
                                return "Drag to create a new point";
                            }
                        };
                        editMarkers.addBillboards(halfPositions, handleEditMarkerChanges);
                        this._editMarkers = editMarkers;
                        // add a handler for clicking in the globe
                        this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                        this._globeClickhandler.setInputAction(
                            function (movement) {
                                var pickedObject = scene.pick(movement.position);
                                if (!(pickedObject && pickedObject.primitive)) {
                                    _self.setEditMode(false);
                                }
                            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                        // set on top of the polygon
                        markers.setOnTop();
                        editMarkers.setOnTop();
                    }
                    this._editMode = true;
                } else {
                    if (this._markers != null) {
                        this._markers.remove();
                        this._editMarkers.remove();
                        this._markers = null;
                        this._editMarkers = null;
                        this._globeClickhandler.destroy();
                    }
                    this._editMode = false;
                }

            }

            DrawHelper.PolylinePrimitive.prototype.setEditable = function () {

                if (this.setEditMode) {
                    return;
                }

                var polyline = this;
                polyline.isPolygon = false;
                polyline.asynchronous = false;

                drawHelper.registerEditableShape(polyline);

                polyline.setEditMode = setEditMode;

                var originalWidth = this.width;

                polyline.setHighlighted = function (highlighted) {
                    // disable if already in edit mode
                    if (this._editMode === true) {
                        return;
                    }
                    if (highlighted) {
                        drawHelper.setHighlighted(this);
                        this.setWidth(originalWidth * 2);
                    } else {
                        this.setWidth(originalWidth);
                    }
                }

                polyline.getExtent = function () {
                    return Cesium.Extent.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(this.positions));
                }

                enhanceWithListeners(polyline);

                polyline.setEditMode(false);

            }

            DrawHelper.PolygonPrimitive.prototype.setEditable = function () {

                var polygon = this;
                polygon.asynchronous = false;
                var scene = drawHelper._scene;
                drawHelper.registerEditableShape(polygon);

                //重写编辑方法
                polygon.setEditMode = function (editMode) {
                    // if no change
                    if (this._editMode == editMode) {
                        return;
                    }
                    drawHelper.disableAllHighlights();
                    // display markers
                    if (editMode) {
                        // make sure all other shapes are not in edit mode before starting the editing of this shape
                        drawHelper.setEdited(this);
                        // create the markers and handlers for the editing
                        if (this._markers == null) {
                            var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                            removeObj.billBoard.push(markers);
                            function onEdited() {
                                polygon.executeListeners({ name: 'onEdited', positions: polygon.positions});
                            }
                            var handleMarkerChanges = {
                                dragHandlers: {
                                    onDrag: function (index, position) {
                                        var controlPoints = polygon.custom;
                                        controlPoints[index] = mousePositionToCartesian3(position);
                                        var doubleArrowResult = xp.algorithm.doubleArrow(controlPoints);
                                        polygon.positions = doubleArrowResult.polygonalPoint//positions
                                        polygon.custom =doubleArrowResult.controlPoint;
                                        polygon._createPrimitive = true;
                                        markers.updateBillboardsPositions(positionToCartesian3(polygon.custom));
                                    },
                                    onDragEnd: function (index, position) {
                                        onEdited();
                                    }
                                },
                                tooltip: function () {
                                    return "拖动以钳击形状";
                                }
                            };
                            var controlPoint = polygon.custom;
                            markers.addBillboards(positionToCartesian3(controlPoint), handleMarkerChanges);
                            this._markers = markers;
                            // add a handler for clicking in the globe
                            this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                            this._globeClickhandler.setInputAction(
                                function (movement) {
                                    var pickedObject = scene.pick(movement.position);
                                    console.log("PolygonPrimitive单击");
                                    // disable edit if pickedobject is different or not an object
                                    //!(pickedObject && !pickedObject.isDestroyed() && pickedObject.primitive)
                                    if (!(pickedObject && pickedObject.primitive)) {
                                        polygon.setEditMode(false);
                                    }
                                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                            // set on top of the polygon
                            markers.setOnTop();
                        }
                        this._editMode = true;
                    } else {
                        if (this._markers != null) {
                            this._markers.remove();
                            this._markers = null;
                            this._globeClickhandler.destroy();
                        }
                        this._editMode = false;
                    }
                }

                polygon.setHighlighted = setHighlighted;

                enhanceWithListeners(polygon);

                polygon.setEditMode(false);

            }

            DrawHelper.TailedAttackPrimitive.prototype.setEditable = function () {

                var polygon = this;
                polygon.asynchronous = false;
                var scene = drawHelper._scene;
                drawHelper.registerEditableShape(polygon);

                //重写编辑方法
                polygon.setEditMode = function (editMode) {
                    // if no change
                    if (this._editMode == editMode) {
                        return;
                    }
                    drawHelper.disableAllHighlights();
                    // display markers
                    if (editMode) {
                        // make sure all other shapes are not in edit mode before starting the editing of this shape
                        drawHelper.setEdited(this);
                        // create the markers and handlers for the editing
                        if (this._markers == null) {
                            var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                            removeObj.billBoard.push(markers);
                            function onEdited() {
                                polygon.executeListeners({ name: 'onEdited', positions: polygon.positions});
                            }
                            var handleMarkerChanges = {
                                dragHandlers: {
                                    onDrag: function (index, position) {
                                        var controlPoints = polygon.custom;
                                        controlPoints[index] = mousePositionToCartesian3(position);
                                        var doubleArrowResult = xp.algorithm.tailedAttackArrow(controlPoints);
                                        polygon.positions = doubleArrowResult.polygonalPoint//positions
                                        polygon.custom =doubleArrowResult.controlPoint;
                                        polygon._createPrimitive = true;
                                        markers.updateBillboardsPositions(positionToCartesian3(polygon.custom));
                                    },
                                    onDragEnd: function (index, position) {
                                        onEdited();
                                    }
                                },
                                tooltip: function () {
                                    return "拖动以改变形状";
                                }
                            };
                            var controlPoint = polygon.custom;
                            markers.addBillboards(positionToCartesian3(controlPoint), handleMarkerChanges);
                            this._markers = markers;
                            // add a handler for clicking in the globe
                            this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                            this._globeClickhandler.setInputAction(
                                function (movement) {
                                    var pickedObject = scene.pick(movement.position);
                                    console.log("TailedAttackPrimitive单击");
                                    // disable edit if pickedobject is different or not an object
                                    if (!(pickedObject && pickedObject.primitive)) {
                                        polygon.setEditMode(false);
                                    }
                                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                            // set on top of the polygon
                            markers.setOnTop();
                        }
                        this._editMode = true;
                    } else {
                        if (this._markers != null) {
                            this._markers.remove();
                            this._markers = null;
                            this._globeClickhandler.destroy();
                        }
                        this._editMode = false;
                    }
                }

                polygon.setHighlighted = setHighlighted;

                enhanceWithListeners(polygon);

                polygon.setEditMode(false);

            }

            DrawHelper.ExtentPrimitive.prototype.setEditable = function () {

                if (this.setEditMode) {
                    return;
                }

                var extent = this;
                var scene = drawHelper._scene;

                drawHelper.registerEditableShape(extent);
                extent.asynchronous = false;

                extent.setEditMode = function (editMode) {
                    // if no change
                    if (this._editMode == editMode) {
                        return;
                    }
                    drawHelper.disableAllHighlights();
                    // display markers
                    if (editMode) {
                        // make sure all other shapes are not in edit mode before starting the editing of this shape
                        drawHelper.setEdited(this);
                        // create the markers and handlers for the editing
                        if (this._markers == null) {
                            var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                            removeObj.billBoard.push(markers);
                            function onEdited() {
                                extent.executeListeners({ name: 'onEdited', extent: extent.extent });
                            }
                            var handleMarkerChanges = {
                                dragHandlers: {
                                    onDrag: function (index, position) {
                                        var first =  mousePositionToCartesian3(position);
                                        var corner = markers.getBillboard((index+1)%2).position;
                                        var second = mousePositionToCartesian3(corner);
                                        var value = index==0?fineArrow(first,second):fineArrow(second,first);
                                        extent.setExtent(value);
                                        markers.updateBillboardsPositions(getArrowCorners(extent.extent));
                                    },
                                    onDragEnd: function (index, position) {
                                        onEdited();
                                    }
                                },
                                tooltip: function () {
                                    return "拖动以改变此箭头形状";
                                }
                            };

                            markers.addBillboards(getArrowCorners(extent.extent), handleMarkerChanges);
                            this._markers = markers;
                            // add a handler for clicking in the globe
                            this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                            this._globeClickhandler.setInputAction(
                                function (movement) {
                                    var pickedObject = scene.pick(movement.position);
                                    console.log("ExtentPrimitive单击");
                                    // disable edit if pickedobject is different or not an object
                                    if (!(pickedObject && pickedObject.primitive)) {
                                        extent.setEditMode(false);
                                    }
                                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                            // set on top of the polygon
                            markers.setOnTop();
                        }
                        this._editMode = true;
                    } else {
                        if (this._markers != null) {
                            this._markers.remove();
                            this._markers = null;
                            this._globeClickhandler.destroy();
                        }
                        this._editMode = false;
                    }
                }

                extent.setHighlighted = setHighlighted;

                enhanceWithListeners(extent);

                extent.setEditMode(false);

            }

        }

        _.DrawHelperWidget = (function () {

            // constructor
            function _(drawHelper, options) {

                // container must be specified
                if (!(Cesium.defined(options.container))) {
                    throw new Cesium.DeveloperError('Container is required');
                }

                var drawOptions = {
                    markerIcon: "./img/glyphicons_242_google_maps.png",
                    polylineIcon: "./img/glyphicons_097_vector_path_line.png",
                    polygonIcon: "./img/qianjijiantou.png",
                    circleIcon: "./img/glyphicons_095_vector_path_circle.png",
                    tailedAttackArrowIcon:"./img/gongjijiantou.png",
                    extentIcon: "./img/zhijiaojiantou.png",
                    clearIcon: "./img/glyphicons_067_cleaning.png",
                    polylineDrawingOptions: defaultPolylineOptions,
                    polygonDrawingOptions: defaultPolygonOptions,
                    extentDrawingOptions: defaultExtentOptions,
                    circleDrawingOptions: defaultCircleOptions
                };

                fillOptions(options, drawOptions);

                var _self = this;

                var toolbar = document.createElement('DIV');
                toolbar.className = "toolbar";
                options.container.appendChild(toolbar);

                function addIcon(id, url, title, callback) {
                    var div = document.createElement('DIV');
                    div.className = 'button';
                    div.title = title;
                    toolbar.appendChild(div);
                    div.onclick = callback;
                    var span = document.createElement('SPAN');
                    div.appendChild(span);
                    var image = document.createElement('IMG');
                    image.src = url;
                    span.appendChild(image);
                    return div;
                }

                var scene2 = drawHelper._scene;

               addIcon('extent', options.extentIcon, '点击以绘制直箭头', function () {
                    drawHelper.startDrawingExtent({
                        callback: function (extent) {
                            _self.executeListeners({ name: 'extentCreated', extent: extent });
                        }
                    });
                })

                addIcon('polygon', options.polygonIcon, '点击以绘制钳击箭头', function () {
                    drawHelper.startDrawingPolygon({
                        callback: function (positions,custom) {
                            _self.executeListeners({ name: 'polygonCreated', positions: positions,custom:custom });
                        }
                    });
                })

                addIcon('tailedAttackArrow', options.tailedAttackArrowIcon, '点击以绘制攻击箭头', function () {
                    drawHelper.startDrawingTailedAttack({
                        callback: function (positions,custom) {
                            _self.executeListeners({ name: 'tailedAttackCreated', positions: positions,custom:custom });
                        }
                    });
                })


                // add a clear button at the end
                // add a divider first
                var div = document.createElement('DIV');
                div.className = 'divider';
                toolbar.appendChild(div);
                addIcon('clear', options.clearIcon, 'Remove all primitives', function () {
                    var primitiveLength = removeObj.primitives.length;
                    var billboardLength = removeObj.billBoard.length;
                    //var logging = document.getElementById('loggingText');
                    //logging.innerHTML = "";
                    for(var i=0;i<primitiveLength;i++) {
                        var primi = removeObj.primitives.pop();
                            primi._globeClickhandler.destroy();
                            scene2.primitives.remove(primi);
                    }
                    for(var i=0;i<billboardLength;i++)  removeObj.billBoard.pop().remove();

                });
                enhanceWithListeners(this);
            }

            return _;

        })();

        _.prototype.addToolbar = function (container, options) {
            options = copyOptions(options, { container: container });
            return new _.DrawHelperWidget(this, options);
        }
        _.DrawWidget=(function(flag){
            function _(drawHelper,flag){
                var _self = this;
                if(flag=="extentCreated"){
                    drawHelper.startDrawingExtent({
                        callback: function (extent) {
                            _self.executeListeners({ name: 'extentCreated', extent: extent });
                        }
                    });
                };
                if(flag=="polygonCreated"){
                    drawHelper.startDrawingPolygon({
                        callback: function (positions,custom) {
                            _self.executeListeners({ name: 'polygonCreated', positions: positions,custom:custom });
                        }
                    });
                };
                if(flag=="tailedAttackCreated"){
                    drawHelper.startDrawingTailedAttack({
                        callback: function (positions,custom) {
                            _self.executeListeners({ name: 'tailedAttackCreated', positions: positions,custom:custom });
                        }
                    });
                };
                enhanceWithListeners(this);
            }
            return _;
        })();
        _.ClearWidget=(function(){
            function _(){
                var scene2 = drawHelper._scene;
                var primitiveLength = removeObj.primitives.length;
                var billboardLength = removeObj.billBoard.length;
                //var logging = document.getElementById('loggingText');
                //logging.innerHTML = "";
                //删除所有
                //for(var i=0;i<primitiveLength;i++) {
                //    var primi = removeObj.primitives.pop();
                //    primi._globeClickhandler.destroy();
                //    scene2.primitives.remove(primi);
                //}
                //for(var i=0;i<billboardLength;i++)  removeObj.billBoard.pop().remove();
                //只删除最后选中的对象
                if(primitiveLength==0||!removeObj.primitives[primitiveLength-1]._editMode){
                    return;
                }else{
                    for(var i=0;i<1;i++) {
                        var primi = removeObj.primitives[primitiveLength-1];
                        primi._globeClickhandler.destroy();
                        scene2.primitives.remove(primi);
                    }
                    for(var i=0;i<1;i++)  removeObj.billBoard[billboardLength-1].remove();
                    removeObj = {billBoard:[],primitives:[]};
                    enhanceWithListeners(this);
                }
            }
            return _;
        })();
        _.prototype.active=function(flag){
            return new _.DrawWidget(this,flag);
        };
        _.prototype.clear=function(){
            return new _.ClearWidget(this);
        };

        function getExtent(mn, mx) {
            var e = new Cesium.Rectangle();

            // Re-order so west < east and south < north
            e.west = Math.min(mn.longitude, mx.longitude);
            e.east = Math.max(mn.longitude, mx.longitude);
            e.south = Math.min(mn.latitude, mx.latitude);
            e.north = Math.max(mn.latitude, mx.latitude);

            // Check for approx equal (shouldn't require abs due to re-order)
            var epsilon = Cesium.Math.EPSILON7;

            if ((e.east - e.west) < epsilon) {
                e.east += epsilon * 2.0;
            }

            if ((e.north - e.south) < epsilon) {
                e.north += epsilon * 2.0;
            }

            return e;
        };

        function mousePositionToCartesian3(position){
            var cartographic = Cesium.Cartographic.fromCartesian(position);
            var lon=Cesium.Math.toDegrees(cartographic.longitude);
            var lat=Cesium.Math.toDegrees(cartographic.latitude);
            return [lon,lat];
        }

        function fineArrow(tailPoint,headerPoint){
           if((tailPoint.length<2)||(headerPoint.length<2))return;
            //画箭头的函数
            var tailWidthFactor=0.15;
            var neckWidthFactor=0.20;
            var headWidthFactor=0.25;
            var headAngle=Math.PI/8.5;
            var neckAngle=Math.PI/13;
            var o = [];
            o[0] = tailPoint;
            o[1] = headerPoint;
            var e = o[0],
            r = o[1],
            n = P.PlotUtils.getBaseLength(o),
            g = n *tailWidthFactor,//尾部宽度因子
            i = n *neckWidthFactor,//脖子宽度银子
            s = n *headWidthFactor,//头部宽度因子
            a = P.PlotUtils.getThirdPoint(r, e, P.Constants.HALF_PI, g, !0),
            l = P.PlotUtils.getThirdPoint(r, e, P.Constants.HALF_PI, g, !1),
            u = P.PlotUtils.getThirdPoint(e, r, headAngle, s, !1),
            c = P.PlotUtils.getThirdPoint(e, r, headAngle, s, !0),
            p = P.PlotUtils.getThirdPoint(e, r, neckAngle, i, !1),
            h = P.PlotUtils.getThirdPoint(e, r, neckAngle, i, !0),
            d=[];
            d.push(a[0],a[1],p[0],p[1],u[0],u[1],r[0],r[1],c[0],c[1],h[0],h[1],l[0],l[1],e[0],e[1]);
            return Cesium.Cartesian3.fromDegreesArray(d);
        }

            /**
         * huoqu
         * @param {Object} positionArr [lon,lat]
         */
        function positionToCartesian3(positionArr){
            var result = []
            for(var i=0;i<positionArr.length;i++){
                var point = Cesium.Cartesian3.fromDegrees(positionArr[i][0],positionArr[i][1],0);
                result.push(point);
            }
            return result;
        }

        //两点之间的距离
        function getDistance(a,b){
            var result =  Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1]-b[1], 2));
            return result;
        }
        var getAzimuth=function(headerPoint,tailPoint){
            //传两个参数,headerPoint和tailPoint,分别是箭头顶部坐标和底部中心坐标,以数组的方式传入
            var e;
            //r是sin角度
            r=Math.asin(Math.abs(tailPoint[1]-headerPoint[1])/getDistance(headerPoint,tailPoint));
            return tailPoint[1] >= headerPoint[1] && headerPoint[0] >= tailPoint[0] ? e = r + Math.PI : tailPoint[1] >= headerPoint[1] && tailPoint[0] < headerPoint[0] ? e = 2*Math.PI - r : tailPoint[1] < headerPoint[1] && tailPoint[0] < headerPoint[0] ? e = r : tailPoint[1] < headerPoint[1] && tailPoint[0] >= headerPoint[0] && (e = Math.PI - r), e;
        }

        var getThirdPoint=function(head,tail,angle,dis,TF){
            var SinAngle=getAzimuth(head,tail),
                i=TF?SinAngle+angle:SinAngle-angle,
                Xs=dis*Math.cos(i),
                Ya=dis*Math.sin(i),
                X=(tail[0]+Xs).toFixed(2),
                Y=(tail[1]+Ya).toFixed(2);
            return [X,Y];
        }


        function getWSG84Coor(p,s){
            var cartesian = viewer.camera.pickEllipsoid(p,s.globe.ellipsoid);
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var len=Cesium.Math.toDegrees(cartographic.longitude);
            var lat=Cesium.Math.toDegrees(cartographic.latitude);
            return [lat,len];
        }

        function createTooltip(frameDiv) {

            var tooltip = function (frameDiv) {

                var div = document.createElement('DIV');
                div.className = "twipsy right";

                var arrow = document.createElement('DIV');
                arrow.className = "twipsy-arrow";
                div.appendChild(arrow);

                var title = document.createElement('DIV');
                title.className = "twipsy-inner";
                div.appendChild(title);

                this._div = div;
                this._title = title;

                // add to frame div and display coordinates
                frameDiv.appendChild(div);
            }

            tooltip.prototype.setVisible = function (visible) {
                this._div.style.display = visible ? 'block' : 'none';
            }

            tooltip.prototype.showAt = function (position, message) {
                if (position && message) {
                    this.setVisible(true);
                    this._title.innerHTML = message;
                    this._div.style.left = position.x + 10 + "px";
                    this._div.style.top = (position.y - this._div.clientHeight / 2) + "px";
                }
            }

            return new tooltip(frameDiv);
        }

        function getDisplayLatLngString(cartographic, precision) {
            return cartographic.longitude.toFixed(precision || 3) + ", " + cartographic.latitude.toFixed(precision || 3);
        }

        function clone(from, to) {
            if (from == null || typeof from != "object") return from;
            if (from.constructor != Object && from.constructor != Array) return from;
            if (from.constructor == Date || from.constructor == RegExp || from.constructor == Function ||
                from.constructor == String || from.constructor == Number || from.constructor == Boolean)
                return new from.constructor(from);

            to = to || new from.constructor();

            for (var name in from) {
                to[name] = typeof to[name] == "undefined" ? clone(from[name], null) : to[name];
            }
            return to;
        }

        function fillOptions(options, defaultOptions) {
            options = options || {};
            var option;
            for (option in defaultOptions) {
                if (options[option] === undefined) {
                    options[option] = clone(defaultOptions[option]);
                }
            }
        }

        // shallow copy
        function copyOptions(options, defaultOptions) {
            var newOptions = clone(options), option;
            for (option in defaultOptions) {
                if (newOptions[option] === undefined) {
                    newOptions[option] = clone(defaultOptions[option]);
                }
            }
            return newOptions;
        }

        function setListener(primitive, type, callback) {
            primitive[type] = callback;
        }

        function enhanceWithListeners(element) {

            element._listeners = {};

            element.addListener = function (name, callback) {
                this._listeners[name] = (this._listeners[name] || []);
                this._listeners[name].push(callback);
                return this._listeners[name].length;
            }

            element.executeListeners = function (event, defaultCallback) {
                if (this._listeners[event.name] && this._listeners[event.name].length > 0) {
                    var index = 0;
                    for (; index < this._listeners[event.name].length; index++) {
                        this._listeners[event.name][index](event);
                    }
                } else {
                    if (defaultCallback) {
                        defaultCallback(event);
                    }
                }
            }

        }

        return _;
    })();
})(window.Cesium);


var P = {version: "1.0.0"}
P.PlotUtils = {}, P.PlotUtils.distance = function(t, o) {
	return Math.sqrt(Math.pow(t[0] - o[0], 2) + Math.pow(t[1] - o[1], 2))
}, P.PlotUtils.wholeDistance = function(t) {
	for (var o = 0, e = 0; e < t.length - 1; e++) o += P.PlotUtils.distance(t[e], t[e + 1]);
	return o
}, P.PlotUtils.getBaseLength = function(t) {
	return Math.pow(P.PlotUtils.wholeDistance(t), .99)
}, P.PlotUtils.mid = function(t, o) {
	return [(t[0] + o[0]) / 2, (t[1] + o[1]) / 2]
}, P.PlotUtils.getCircleCenterOfThreePoints = function(t, o, e) {
	var r = [(t[0] + o[0]) / 2, (t[1] + o[1]) / 2],
		n = [r[0] - t[1] + o[1], r[1] + t[0] - o[0]],
		g = [(t[0] + e[0]) / 2, (t[1] + e[1]) / 2],
		i = [g[0] - t[1] + e[1], g[1] + t[0] - e[0]];
	return P.PlotUtils.getIntersectPoint(r, n, g, i)
}, P.PlotUtils.getIntersectPoint = function(t, o, e, r) {
	if (t[1] == o[1]) {
		var n = (r[0] - e[0]) / (r[1] - e[1]),
			g = n * (t[1] - e[1]) + e[0],
			i = t[1];
		return [g, i]
	}
	if (e[1] == r[1]) {
		var s = (o[0] - t[0]) / (o[1] - t[1]);
		return g = s * (e[1] - t[1]) + t[0], i = e[1], [g, i]
	}
	return s = (o[0] - t[0]) / (o[1] - t[1]), n = (r[0] - e[0]) / (r[1] - e[1]), i = (s * t[1] - t[0] - n * e[1] + e[0]) / (s - n), g = s * i - s * t[1] + t[0], [g, i]
}, P.PlotUtils.getAzimuth = function(t, o) {
	var e, r = Math.asin(Math.abs(o[1] - t[1]) / P.PlotUtils.distance(t, o));
	return o[1] >= t[1] && o[0] >= t[0] ? e = r + Math.PI : o[1] >= t[1] && o[0] < t[0] ? e = P.Constants.TWO_PI - r : o[1] < t[1] && o[0] < t[0] ? e = r : o[1] < t[1] && o[0] >= t[0] && (e = Math.PI - r), e
}, P.PlotUtils.getAngleOfThreePoints = function(t, o, e) {
	var r = P.PlotUtils.getAzimuth(o, t) - P.PlotUtils.getAzimuth(o, e);
	return 0 > r ? r + P.Constants.TWO_PI : r
}, P.PlotUtils.isClockWise = function(t, o, e) {
	return (e[1] - t[1]) * (o[0] - t[0]) > (o[1] - t[1]) * (e[0] - t[0])
}, P.PlotUtils.getPointOnLine = function(t, o, e) {
	var r = o[0] + t * (e[0] - o[0]),
		n = o[1] + t * (e[1] - o[1]);
	return [r, n]
}, P.PlotUtils.getCubicValue = function(t, o, e, r, n) {
	t = Math.max(Math.min(t, 1), 0);
	var g = 1 - t,
		i = t * t,
		s = i * t,
		a = g * g,
		l = a * g,
		u = l * o[0] + 3 * a * t * e[0] + 3 * g * i * r[0] + s * n[0],
		c = l * o[1] + 3 * a * t * e[1] + 3 * g * i * r[1] + s * n[1];
	return [u, c]
}, P.PlotUtils.getThirdPoint = function(t, o, e, r, n) {
	var g = P.PlotUtils.getAzimuth(t, o),
		i = n ? g + e : g - e,
		s = r * Math.cos(i),
		a = r * Math.sin(i);
	return [o[0] + s, o[1] + a]
}, P.PlotUtils.getArcPoints = function(t, o, e, r) {
	var n, g, i = [],
		s = r - e;
	s = 0 > s ? s + P.Constants.TWO_PI : s;
	for (var a = 0; a <= P.Constants.FITTING_COUNT; a++) {
		var l = e + s * a / P.Constants.FITTING_COUNT;
		n = t[0] + o * Math.cos(l), g = t[1] + o * Math.sin(l), i.push([n, g])
	}
	return i
}, P.PlotUtils.getBisectorNormals = function(t, o, e, r) {
	var n = P.PlotUtils.getNormal(o, e, r),
		g = Math.sqrt(n[0] * n[0] + n[1] * n[1]),
		i = n[0] / g,
		s = n[1] / g,
		a = P.PlotUtils.distance(o, e),
		l = P.PlotUtils.distance(e, r);
	if (g > P.Constants.ZERO_TOLERANCE) if (P.PlotUtils.isClockWise(o, e, r)) {
		var u = t * a,
			c = e[0] - u * s,
			p = e[1] + u * i,
			h = [c, p];
		u = t * l, c = e[0] + u * s, p = e[1] - u * i;
		var d = [c, p]
	} else u = t * a, c = e[0] + u * s, p = e[1] - u * i, h = [c, p], u = t * l, c = e[0] - u * s, p = e[1] + u * i, d = [c, p];
	else c = e[0] + t * (o[0] - e[0]), p = e[1] + t * (o[1] - e[1]), h = [c, p], c = e[0] + t * (r[0] - e[0]), p = e[1] + t * (r[1] - e[1]), d = [c, p];
	return [h, d]
}, P.PlotUtils.getNormal = function(t, o, e) {
	var r = t[0] - o[0],
		n = t[1] - o[1],
		g = Math.sqrt(r * r + n * n);
	r /= g, n /= g;
	var i = e[0] - o[0],
		s = e[1] - o[1],
		a = Math.sqrt(i * i + s * s);
	i /= a, s /= a;
	var l = r + i,
		u = n + s;
	return [l, u]
}, P.PlotUtils.getCurvePoints = function(t, o) {
	for (var e = P.PlotUtils.getLeftMostControlPoint(o), r = [e], n = 0; n < o.length - 2; n++) {
		var g = o[n],
			i = o[n + 1],
			s = o[n + 2],
			a = P.PlotUtils.getBisectorNormals(t, g, i, s);
		r = r.concat(a)
	}
	var l = P.PlotUtils.getRightMostControlPoint(o);
	r.push(l);
	var u = [];
	for (n = 0; n < o.length - 1; n++) {
		g = o[n], i = o[n + 1], u.push(g);
		for (var t = 0; t < P.Constants.FITTING_COUNT; t++) {
			var c = P.PlotUtils.getCubicValue(t / P.Constants.FITTING_COUNT, g, r[2 * n], r[2 * n + 1], i);
			u.push(c)
		}
		u.push(i)
	}
	return u
}, P.PlotUtils.getLeftMostControlPoint = function(o) {
	var e = o[0],
		r = o[1],
		n = o[2],
		g = P.PlotUtils.getBisectorNormals(0, e, r, n),
		i = g[0],
		s = P.PlotUtils.getNormal(e, r, n),
		a = Math.sqrt(s[0] * s[0] + s[1] * s[1]);
	if (a > P.Constants.ZERO_TOLERANCE) var l = P.PlotUtils.mid(e, r),
		u = e[0] - l[0],
		c = e[1] - l[1],
		p = P.PlotUtils.distance(e, r),
		h = 2 / p,
		d = -h * c,
		f = h * u,
		E = d * d - f * f,
		v = 2 * d * f,
		A = f * f - d * d,
		_ = i[0] - l[0],
		y = i[1] - l[1],
		m = l[0] + E * _ + v * y,
		O = l[1] + v * _ + A * y;
	else m = e[0] + t * (r[0] - e[0]), O = e[1] + t * (r[1] - e[1]);
	return [m, O]
}, P.PlotUtils.getRightMostControlPoint = function(o) {
	var e = o.length,
		r = o[e - 3],
		n = o[e - 2],
		g = o[e - 1],
		i = P.PlotUtils.getBisectorNormals(0, r, n, g),
		s = i[1],
		a = P.PlotUtils.getNormal(r, n, g),
		l = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
	if (l > P.Constants.ZERO_TOLERANCE) var u = P.PlotUtils.mid(n, g),
		c = g[0] - u[0],
		p = g[1] - u[1],
		h = P.PlotUtils.distance(n, g),
		d = 2 / h,
		f = -d * p,
		E = d * c,
		v = f * f - E * E,
		A = 2 * f * E,
		_ = E * E - f * f,
		y = s[0] - u[0],
		m = s[1] - u[1],
		O = u[0] + v * y + A * m,
		T = u[1] + A * y + _ * m;
	else O = g[0] + t * (n[0] - g[0]), T = g[1] + t * (n[1] - g[1]);
	return [O, T]
}, P.PlotUtils.getBezierPoints = function(t) {
	if (t.length <= 2) return t;
	for (var o = [], e = t.length - 1, r = 0; 1 >= r; r += .01) {
		for (var n = y = 0, g = 0; e >= g; g++) {
			var i = P.PlotUtils.getBinomialFactor(e, g),
				s = Math.pow(r, g),
				a = Math.pow(1 - r, e - g);
			n += i * s * a * t[g][0], y += i * s * a * t[g][1]
		}
		o.push([n, y])
	}
	return o.push(t[e]), o
}, P.PlotUtils.getBinomialFactor = function(t, o) {
	return P.PlotUtils.getFactorial(t) / (P.PlotUtils.getFactorial(o) * P.PlotUtils.getFactorial(t - o))
}, P.PlotUtils.getFactorial = function(t) {
	if (1 >= t) return 1;
	if (2 == t) return 2;
	if (3 == t) return 6;
	if (4 == t) return 24;
	if (5 == t) return 120;
	for (var o = 1, e = 1; t >= e; e++) o *= e;
	return o
}, P.PlotUtils.getQBSplinePoints = function(t) {
	if (t.length <= 2) return t;
	var o = 2,
		e = [],
		r = t.length - o - 1;
	e.push(t[0]);
	for (var n = 0; r >= n; n++) for (var g = 0; 1 >= g; g += .05) {
		for (var i = y = 0, s = 0; o >= s; s++) {
			var a = P.PlotUtils.getQuadricBSplineFactor(s, g);
			i += a * t[n + s][0], y += a * t[n + s][1]
		}
		e.push([i, y])
	}
	return e.push(t[t.length - 1]), e
}, P.PlotUtils.getQuadricBSplineFactor = function(t, o) {
	return 0 == t ? Math.pow(o - 1, 2) / 2 : 1 == t ? (-2 * Math.pow(o, 2) + 2 * o + 1) / 2 : 2 == t ? Math.pow(o, 2) / 2 : 0
},P.Constants = {
	TWO_PI: 2 * Math.PI,
	HALF_PI: Math.PI / 2,
	FITTING_COUNT: 100,
	ZERO_TOLERANCE: 1e-4
};
(function(Cesium){
    "use strict";
    /**
     * 三维地图面积量插件算类
     *
     * @alias MeasureAreaWidget
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer].
     * @param {Color} [options.color = Cesium.Color.CHARTREUSE.withAlpha(0.5)] 绘制面颜色.
     * @param {Number} [options.lineWidth=2.0] 绘制面边框宽度.
     *
     *
     * @example
     * // 初始化控件.
     * var MeasureAreaWidget = new Cesium.MeasureAreaWidget({
     *     viewer：viewr
     * });
     */
    var MeasureAreaWidget = Cesium.MeasureAreaWidget = function(options,callback) {
        this.viewer = options.viewer;
        this.color = options.color?options.color:Cesium.Color.CHARTREUSE.withAlpha(0.5);;
        this.lineWidth = options.lineWidth?options.lineWidth:2;
        this.scene = this.viewer.scene;
        this.camera = this.viewer.camera;
        this.canvas = this.scene.canvas;
        this.primitives = this.scene.primitives;
        this.ellipsoid = this.scene.globe.ellipsoid;
    };
    /**
     * 激活控件：激活面积量算插件，左键开始绘制，右键结束绘制
     */
    MeasureAreaWidget.prototype.activate = function() {
        if(this.handler) return;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.viewer.canvas.style.cursor = "crosshair";
        var that = this;
        var array = [];//点数组   []
        var polylines,labels,points;
        this._array_=array;
        this._polylines_=polylines;
        this._labels_=labels;
        this.handler.setInputAction(function(p){
            that.lastP=p;
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            array.push(cartesian);
            if (array.length==1) {
                polylines = that.primitives.add(new Cesium.PolylineCollection());
                polylines.name = "draw_polyline";
                polylines.add({
                    polyline:{}
                });
                polylines.get(polylines.length-1).width = that.lineWidth;
                polylines.get(polylines.length-1).loop = true;
                polylines.get(polylines.length-1).material.uniforms.color = that.color;
                polylines.get(polylines.length-1).positions=array;
            }
            if (array.length>=3) {
                polylines.get(polylines.length-1).positions=array;
                if(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent)){
                    that.measureEnd();
                }
            }
            that._polylines_=polylines;
            //在移动端点击添加点注记
            if(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent)) {
                points = that.primitives.add(new Cesium.PointPrimitiveCollection());
                points.name = "draw_point";
                points.add({
                    position : cartesian,
                    color : Cesium.Color.WHITE,
                    outlineColor : Cesium.Color.RED,
                    outlineWidth : 1.0,
                    pixelSize :5
                });
            }
        },Cesium.ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function(p){
            if(!(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent))) {
                var ray = that.camera.getPickRay(p.endPosition);
                var cartesian = that.scene.globe.pick(ray, that.scene);
                if (!cartesian) {
                    if (labels) {
                        that.primitives.remove(labels);
                        labels = null;
                    }
                    return;
                }
                ;
                if (array.length >= 1) {
                    var tempArray = array.concat();
                    tempArray.push(cartesian);
                    polylines.get(polylines.length - 1).positions = tempArray;
                }
                if (!labels) {
                    labels = that.primitives.add(new Cesium.LabelCollection());
                    labels.name = "draw_label";
                    labels.add({
                        text: '左键单击开始绘制，右键单击结束绘制',
                        font: '16px sans-serif',
                        showBackground: true
                    });
                    labels.get(labels.length - 1).position = cartesian;
                }else{
                    labels.get(labels.length-1).position = cartesian;
                }
                that._labels_ = labels;
            }
        },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.setInputAction(function(p){
            that.measureEnd();
            that.handler = that.handler && that.handler.destroy();
            that.viewer.canvas.style.cursor = "default";
        },Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    /**
     * 显示面积测量结果
     */
    MeasureAreaWidget.prototype.measureEnd = function(p) {
        if(this._array_==undefined||this._array_.length==0){
            return;
        }else{

            //$("#monomer-content").children().removeClass("active");
            //绘制完成,清除提示
            if(this._labels_){
                this.primitives.remove(this._labels_);
                this._labels_=null;
            }
            if(!p){
                //console.log("快结束了");
                p=this.lastP;
            }
            var ray = this.camera.getPickRay(p.position);
            var cartesian = this.scene.globe.pick(ray,this.scene);
            if(!cartesian) return;
            this._array_.push(cartesian);
            this._polylines_.get(this._polylines_.length-1).material.uniforms.color = Cesium.Color.CHARTREUSE.withAlpha(0);
            this.viewer.entities.add({
                name:"draw_polygon",
                polygon : {
                    hierarchy : {
                        positions : this._array_
                    },
                    material : this.color
                }
            });
            var tempArray = [];
            for(var i=0;i<this._array_.length;i++){
                var cartographic = Cesium.Cartographic.fromCartesian(this._array_[i]);
                var lng = Cesium.Math.toDegrees(cartographic.longitude);
                var lat = Cesium.Math.toDegrees(cartographic.latitude);
                tempArray.push([lng,lat]);
            }
            //首尾相连
            tempArray.push(tempArray[0]);
            var polygon = turf.polygon([tempArray]);
            var area = turf.area(polygon);
            var result;
            if(area<1000000){
                result = "总面积："+area.toFixed(2)+"m²";
            }else{
                result = "总面积："+(area/1000000).toFixed(2)+"km²";
            }
            if(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent)){
                if(this.primitives.length>4){
                    this.primitives.remove(this.primitives.get(this.primitives.length-2));
                    createResultLabel(this.primitives,result,this._array_);
                }else{
                    createResultLabel(this.primitives,result,this._array_);
                }
            }else{
                createResultLabel(this.primitives,result,this._array_);
            }
        }
        //this._array_=[];
        //this._polylines_=null;
    }
    /**
     * 清除量算结果
     */
    MeasureAreaWidget.prototype.clear = function() {
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //清除 绘制痕迹
        clearPrimitiveByName("result_label",this.primitives);
        clearPrimitiveByName("draw_label",this.primitives);
        clearPrimitiveByName("draw_polyline",this.primitives);
        clearEntityByName("draw_polygon",this.viewer.entities);
    };
    //生成结果label
    function createResultLabel(primitives,result,array){
        //生成显示结果的label
        var labels = primitives.add(new Cesium.LabelCollection());
        labels.name = "result_label";
        labels.add({
            text : result,
            font : '16px sans-serif',
            showBackground : true
        });
        labels.get(labels.length-1).position = array[array.length-1];
    }
    //清除primitive绘制痕迹
    function clearPrimitiveByName(name,primitives){
        for(var i=0;i<primitives.length;i++){
            if(primitives.get(i).name==name){
                primitives.remove(primitives.get(i));
                i--;
            }
        }
    }
    //清除entity绘制痕迹
    function clearEntityByName(name,entities) {
        var temp = entities.values;
        for(var i=0;i<temp.length;i++){
            if(temp[i].name == name){
                entities.remove(temp[i]);
                i--;
            }
        }
    }
})(window.Cesium);
(function(Cesium){
    "use strict";
    /**
     * 三维地图距离量算插件类
     *
     * @alias MeasureDistanceWidget
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer].
     * @param {Color} [options.color = Cesium.Color.CHARTREUSE.withAlpha(0.5)] 绘制线颜色.
     * @param {Number} [options.lineWidth=2.0] 绘制面边框宽度.
     * @param {Number} [options.mode=1] 1：空间量算，2：贴地量算.
     *
     * @example
     * // 初始化控件.
     * var MeasureDistanceWidget = new Cesium.MeasureDistanceWidget({
     *     viewer：viewr
     * });
     */
    var MeasureDistanceWidget = Cesium.MeasureDistanceWidget = function(options,callback) {
        this.viewer = options.viewer;
        this.color = options.color?options.color:Cesium.Color.CHARTREUSE.withAlpha(0.5);
        this.lineWidth = options.lineWidth?options.lineWidth:2;
        this.scene = this.viewer.scene;
        this.camera = this.viewer.camera;
        this.canvas = this.scene.canvas;
        this.primitives = this.scene.primitives;
        this.ellipsoid = this.scene.globe.ellipsoid;
        this.mode = options.mode?options.mode:1;
    };
    /**
     * 激活控件：激活距离量算绘制插件，左键开始绘制，右键结束绘制
     */
    MeasureDistanceWidget.prototype.activate = function(){
        //if(this.handler) return;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.viewer.canvas.style.cursor = "crosshair";
        var that = this;
        var array = [];//点数组   [lng,lat,height,...]
        var polylines,labels,points;
        this._array_ = array;
        this._polylines_ = polylines;
        this._labels_ = labels;
        this.handler.setInputAction(function(p){
            that.lastP = p;
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            array.push(lng);
            array.push(lat);
            array.push(height);
            if (array.length==3) {
                polylines = that.primitives.add(new Cesium.PolylineCollection());
                polylines.name = "draw_polyline";
                polylines.add({
                    polyline:{}
                });
                polylines.get(polylines.length-1).width = that.lineWidth;
                polylines.get(polylines.length-1).material.uniforms.color = that.color;
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
            }
            if (array.length>3) {
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
            }
            that._polylines_ = polylines;
            //在移动端点击添加点注记
            //if(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent)){
            points = that.primitives.add(new Cesium.PointPrimitiveCollection());
            points.name = "draw_point";
            points.add({
                position : cartesian,
                color : Cesium.Color.WHITE,
                outlineColor : Cesium.Color.RED,
                outlineWidth : 1.0,
                pixelSize :that.pixelSize
            });
            that.flag=false;
            that.measureEnd(p);
            //}
        },Cesium.ScreenSpaceEventType.LEFT_DOWN );
        this.handler.setInputAction(function(p){
            var ray = that.camera.getPickRay(p.endPosition);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if (!cartesian) {
                if(labels){
                    that.primitives.remove(labels);
                    labels=null;
                }
                return;
            };
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            if(!(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent))){
                if (array.length>=3) {
                    var tempArray = array.concat();
                        tempArray.push(lng);
                        tempArray.push(lat);
                        tempArray.push(height);
                        polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(tempArray);
                }
                if(!labels){
                    labels = that.primitives.add(new Cesium.LabelCollection());
                    labels.name = "draw_label";
                    labels.add({
                        text : '左键单击开始绘制，右键单击结束绘制',
                        font : '16px sans-serif',
                        showBackground : true
                    });
                    labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
                }
                //else{
                //    labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
                //}
            }else{
                labels=null;
            }
            that._labels_ = labels;
        },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.setInputAction(function(p){
            that.flag=true;
            p = that.lastP;
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            points = that.primitives.add(new Cesium.PointPrimitiveCollection());
            points.name = "draw_point";
            points.add({
                position : cartesian,
                color : Cesium.Color.WHITE,
                outlineColor : Cesium.Color.RED,
                outlineWidth : 1.0,
                pixelSize :that.pixelSize
            });
            that._array_.push(lng);
            that._array_.push(lat);
            that._array_.push(height);
            that.measureEnd(p);
            that.handler = that.handler && that.handler.destroy();
            that.viewer.canvas.style.cursor = "default";
            that._array_=[];
            that._polylines_=null;
        },Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    /**
     * 显示距离测量结果
     */
    MeasureDistanceWidget.prototype.measureEnd=function(p){
        if(this._array_==undefined||this._array_.length==0){
            return;
        }else{
            if(!(/Android|webOS|iPhone|ipad|iPod|BlackBerry/i.test(navigator.userAgent))){
                if(!p){
                    //console.log("点击按钮结束绘制");
                    p = this.lastP;
                    var ray = this.camera.getPickRay(p.position);
                    var cartesian = this.scene.globe.pick(ray,this.scene);
                    if(!cartesian) return;
                    var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                    var lng = Cesium.Math.toDegrees(cartographic.longitude);
                    var lat = Cesium.Math.toDegrees(cartographic.latitude);
                    var height = cartographic.height;
                    if(this._array_[this._array_.length-1]==height&&this._array_[this._array_.length-2]==lat&&this._array_[this._array_.length-3]==lng){
                        this._array_=this._array_;
                    }else{
                        this._array_.push(lng);
                        this._array_.push(lat);
                        this._array_.push(height);
                    }
                }
            }else{
                this._array_=this._array_;
            }

            if(this._labels_){
                this.primitives.remove(this._labels_);
                this._labels_=null;
            }
            var result;
            var mode = this.mode;
            if (this.mode ==2) {//贴地绘制 ，默认mode=1，空间绘制
                var lerpArray = lerp(this._array_,this.scene);
                this._polylines_.get(this._polylines_.length-1).material.uniforms.color = Cesium.Color.CHARTREUSE.withAlpha(0);
                this.viewer.entities.add({
                    name:"draw_polyline",
                    polyline : {
                        positions : Cesium.Cartesian3.fromDegreesArrayHeights(lerpArray),
                        width : this.lineWidth,
                        material : this.color
                    }
                });
            }
            var tempArray = Cesium.Cartesian3.fromDegreesArrayHeights(this._array_);
            var distance = 0;
            var result;
            var geodesic = new Cesium.EllipsoidGeodesic();
            if(mode==1){
                for(var i=1;i<tempArray.length;i++){
                    var cartographic1 = Cesium.Cartographic.fromCartesian(tempArray[i-1]);
                    var lng1 = Cesium.Math.toDegrees(cartographic1.longitude);
                    var lat1 = Cesium.Math.toDegrees(cartographic1.latitude);
                    var cartographic2 = Cesium.Cartographic.fromCartesian(tempArray[i]);
                    var lng2 = Cesium.Math.toDegrees(cartographic2.longitude);
                    var lat2 = Cesium.Math.toDegrees(cartographic2.latitude);
                    var from = turf.point([lng1, lat1]);
                    var to = turf.point([lng2, lat2]);
                    distance +=turf.distance(from, to);
                }
                if(distance==0){
                    result = "起点";
                }else if(distance>0&&distance<1){
                    this.flag?result = "总长："+(distance*1000).toFixed(2)+"m":result = (distance*1000).toFixed(2)+"m";
                }else{
                    this.flag?result = "总长："+(distance).toFixed(2)+"km":result = (distance).toFixed(2)+"km";
                }
            }else if(mode==2){
                for(var i=1;i<tempArray.length;i++){
                    var startCartographic = Cesium.Cartographic.fromCartesian(tempArray[i-1]);
                    var endCartographic = Cesium.Cartographic.fromCartesian(tempArray[i]);
                    geodesic.setEndPoints(startCartographic, endCartographic);
                    var lengthInMeters = Math.round(geodesic.surfaceDistance);
                    distance +=lengthInMeters;
                    distance=Number(distance);
                }
                if(distance==0){
                    result = "起点";
                }else if(distance>0&&distance<1000){
                    this.flag?result = "总长："+distance.toFixed(2)+"m":result =distance.toFixed(2)+"m";
                }else{
                    this.flag?result = "总长："+(distance/1000).toFixed(2)+"km":result =(distance/1000).toFixed(2)+"km";
                }
            }
            createResultLabel(this.primitives,result,tempArray);
        }
    }
    /**
     * 清除量算结果
     */
    MeasureDistanceWidget.prototype.clear = function(){
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //清除 绘制痕迹
        clearPrimitiveByName("result_label",this.primitives);
        clearPrimitiveByName("draw_label",this.primitives);
        clearPrimitiveByName("draw_polyline",this.primitives);
        clearEntityByName("draw_polyline",this.viewer.entities);
    };
    //生成结果label
    function createResultLabel(primitives,result,array){
        //生成显示结果的label
        var labels = primitives.add(new Cesium.LabelCollection());
        labels.name = "result_label";
        labels.add({
            text : result,
            font : '16px sans-serif',
            showBackground : true,
            pixelOffset:new Cesium.Cartesian2(10,10)
        });
        labels.get(labels.length-1).position = array[array.length-1];
    }
    //清除primitive绘制痕迹
    function clearPrimitiveByName(name,primitives){
        for(var i=0;i<primitives.length;i++){
            if(primitives.get(i).name==name){
                primitives.remove(primitives.get(i));
                i--;
            }
        }
    }
    //清除entity绘制痕迹
    function clearEntityByName(name,entities) {
        var temp = entities.values;
        for(var i=0;i<temp.length;i++){
            if(temp[i].name == name){
                entities.remove(temp[i]);
                i--;
            }
        }
    }
    //插值
    function lerp(array,scene) {
        var lerpArray = [];
        //for(var i=0;i<array.length-5;i=i+3){
        for(var i=0;i<array.length/3-1;i++){
            var t = i*3;
            var lng_s = array[t];
            var lat_s = array[t+1];
            var height_s = array[t+2];
            var lng_e = array[t+3];
            var lat_e = array[t+4];
            var height_e = array[t+5];
            //插入起点
            lerpArray.push(lng_s);
            lerpArray.push(lat_s);
            lerpArray.push(height_s);
            //插入插值
            for(var j=0;j<100;j++){//插值数100
                var cartographic_s = {
                    longitude:Cesium.Math.toRadians(lng_s),
                    latitude:Cesium.Math.toRadians(lat_s),
                    height:height_s
                };
                var cartographic_e = {
                    longitude:Cesium.Math.toRadians(lng_e),
                    latitude:Cesium.Math.toRadians(lat_e),
                    height:height_e
                };
                var longitude_lerp = Cesium.Math.lerp(cartographic_s.longitude,cartographic_e.longitude,0.01*(j+1));
                var latitude_lerp = Cesium.Math.lerp(cartographic_s.latitude,cartographic_e.latitude,0.01*(j+1));
                //得到当前地形高度
                var cartographic_lerp ={
                    longitude:longitude_lerp,
                    latitude:latitude_lerp
                }
                var height_lerp = scene.globe.getHeight(cartographic_lerp);

                lerpArray.push(Cesium.Math.toDegrees(longitude_lerp));
                lerpArray.push(Cesium.Math.toDegrees(latitude_lerp));
                lerpArray.push(height_lerp);
            }
            //插入终点
            lerpArray.push(lng_e);
            lerpArray.push(lat_e);
            lerpArray.push(height_e);
        }
        return lerpArray;
    }
})(window.Cesium);
(function(Cesium){
    "use strict";
    /**
     * 三维地图高程量算插件类
     *
     * @alias MeasureElevationWidget
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer].
     * @param {Color} [options.color = Cesium.Color.CHARTREUSE.withAlpha(0.5)] 绘制点颜色.
     * @param {Number} [options.pixelSize=2.0] 绘制点大小.
     *
     * @example
     * // 初始化控件.
     * var Cesium.MeasureElevationWidget = new Cesium.MeasureElevationWidget({
     *     viewer：viewr
     * });
     */
    var MeasureElevationWidget = Cesium.MeasureElevationWidget = function(options,callback) {
        this.viewer = options.viewer;
        this.color = options.color?options.color:Cesium.Color.YELLOW;
        this.pixelSize = options.pixelSize?options.pixelSize:10;
        this.scene = this.viewer.scene;
        this.camera = this.viewer.camera;
        this.canvas = this.scene.canvas;
        this.primitives = this.scene.primitives;
        this.ellipsoid = this.scene.globe.ellipsoid;
    };
    /**
     * 激活控件：激活高程量算插件，左键开始绘制，右键结束绘制
     */
    MeasureElevationWidget.prototype.activate = function(){
        if(this.handler) return;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.viewer.canvas.style.cursor = "crosshair";
        var that = this;
        var array = [];//点数组
        var points,labels;
        this.handler.setInputAction(function(p){
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            array[0]=cartesian;
            if(points){
                points.removeAll();
            }else{
                points = that.primitives.add(new Cesium.PointPrimitiveCollection());
                points.name = "draw_point";
            }

            points.add({
                position : cartesian,
                color : that.color,
                pixelSize :that.pixelSize
            });

            that.handler = that.handler && that.handler.destroy();
            that.viewer.canvas.style.cursor = "default";
            //绘制完成,清除提示
            if(labels){
                that.primitives.remove(labels);
                labels=null;
            }
            var cartographic = Cesium.Cartographic.fromCartesian(array[0]);
            var elevation = cartographic.height;
            var result = "高程值："+elevation.toFixed(2)+"m";
            createResultLabel(that.primitives,result,array);
        },Cesium.ScreenSpaceEventType.LEFT_CLICK);
        //this.handler.setInputAction(function(p){
        //    var ray = that.camera.getPickRay(p.endPosition);
        //    var cartesian = that.scene.globe.pick(ray,that.scene);
        //    if (!cartesian) {
        //        if(labels){
        //            that.primitives.remove(labels);
        //            labels=null;
        //        }
        //        return;
        //    };
        //    if(!labels){
        //        labels = that.primitives.add(new Cesium.LabelCollection());
        //        labels.name = "draw_label";
        //        labels.add({
        //            text : '左键单击开始绘制，右键单击结束绘制',
        //            font : '16px sans-serif',
        //            showBackground : true
        //        });
        //        labels.get(labels.length-1).position = cartesian;
        //    }else{
        //        labels.get(labels.length-1).position = cartesian;
        //    }
        //},Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        //this.handler.setInputAction(function(p){
        //    that.handler = that.handler && that.handler.destroy();
        //    that.viewer.canvas.style.cursor = "default";
        //    //绘制完成,清除提示
        //    if(labels){
        //        that.primitives.remove(labels);
        //        labels=null;
        //    }
        //    var cartographic = Cesium.Cartographic.fromCartesian(array[0]);
        //    var elevation = cartographic.height;
        //    var result = "高程值："+elevation.toFixed(2)+"m";
        //    createResultLabel(that.primitives,result,array);
        //},Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    /**
     * 清除量算结果
     */
    MeasureElevationWidget.prototype.clear = function(){
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //清除 绘制痕迹
        clearPrimitiveByName("result_label",this.primitives);
        clearPrimitiveByName("draw_label",this.primitives);
        clearPrimitiveByName("draw_point",this.primitives);
    };
    //生成结果label
    function createResultLabel(primitives,result,array){
        //生成显示结果的label
        var labels = primitives.add(new Cesium.LabelCollection());
        labels.name = "result_label";
        labels.add({
            text : result,
            font : '16px sans-serif',
            showBackground : true
        });
        labels.get(labels.length-1).position = array[array.length-1];
    }
    //清除primitive绘制痕迹
    function clearPrimitiveByName(name,primitives){
        for(var i=0;i<primitives.length;i++){
            if(primitives.get(i).name==name){
                primitives.remove(primitives.get(i));
                i--;
            }
        }
    }
})(window.Cesium);
(function(Cesium){
    "use strict";
    /**
     * 三维地图高度量算插件类
     *
     * @alias MeasureHeightWidget
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer].
     * @param {Color} [options.color = Cesium.Color.CHARTREUSE.withAlpha(0.5)] 绘制线颜色.
     * @param {Number} [options.lineWidth=2.0] 绘制面边框宽度.
     *
     * @example
     * // 初始化控件.
     * var Cesium.MeasureHeightWidget = new Cesium.MeasureHeightWidget({
     *     viewer：viewr
     * });
     */
    var MeasureHeightWidget = Cesium.MeasureHeightWidget = function(options,callback) {
        this.viewer = options.viewer;
        this.color = options.color?options.color:Cesium.Color.CHARTREUSE.withAlpha(0.5);
        this.lineWidth = options.lineWidth?options.lineWidth:2;
        this.scene = this.viewer.scene;
        this.camera = this.viewer.camera;
        this.canvas = this.scene.canvas;
        this.primitives = this.scene.primitives;
        this.ellipsoid = this.scene.globe.ellipsoid;
    };
    /**
     * 激活控件：激活高度量算插件，左键开始绘制，右键结束绘制
     */
    MeasureHeightWidget.prototype.activate = function(){
        if(this.handler) return;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.canvas);
        this.viewer.canvas.style.cursor = "crosshair";
        var that = this;
        var array = [];//点数组   []
        var polylines,labels,points;
        this._array_ = array;
        this._polylines_ = polylines;
        this._labels_ = labels;
        this.handler.setInputAction(function(p){
            var ray = that.camera.getPickRay(p.position);
            var cartesian = that.scene.globe.pick(ray,that.scene);
            if(!cartesian) return;
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            if(array.length>0){
                //在移动端点击添加点注记
                if (array.length==9) {
                    //改变第二个点的值
                    array[3] = lng;
                    array[4] = lat;
                    array[5] = height;
                    //根据一二两个点的位置判断第三个点的位置（比较高度）
                    if(array[2]>=array[5]){
                        array[6] = array[0];
                        array[7] = array[1];
                        array[8] = array[5];
                    }else{
                        array[6] = array[3];
                        array[7] = array[4];
                        array[8] = array[2];
                    }
                    polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
                }
                points = that.primitives.add(new Cesium.PointPrimitiveCollection());
                points.name = "draw_point";
                points.add({
                    position : cartesian,
                    color : that.color,
                    pixelSize :that.pixelSize
                });
                that._array_=array;
                that.measureEnd();
            };
            if(array.length==0){
                //默认三个点位置相同
                array.push(lng);
                array.push(lat);
                array.push(height);
                array.push(lng);
                array.push(lat);
                array.push(height);
                array.push(lng);
                array.push(lat);
                array.push(height);
                polylines = that.primitives.add(new Cesium.PolylineCollection());
                polylines.name = "draw_polyline";
                polylines.add({
                    polyline:{}
                });
                polylines.get(polylines.length-1).width = that.lineWidth;
                polylines.get(polylines.length-1).loop = true;
                polylines.get(polylines.length-1).material.uniforms.color = that.color;
                polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);

                points = that.primitives.add(new Cesium.PointPrimitiveCollection());
                points.name = "draw_point";
                points.add({
                    position : cartesian,
                    color : that.color,
                    pixelSize :that.pixelSize
                });
            }
        },Cesium.ScreenSpaceEventType.LEFT_CLICK);
    //    this.handler.setInputAction(function(p){
    //        var ray = that.camera.getPickRay(p.endPosition);
    //        var cartesian = that.scene.globe.pick(ray,that.scene);
    //        if (!cartesian) {
    //            if(labels){
    //                that.primitives.remove(labels);
    //                labels=null;
    //            }
    //            return;
    //        };
    //        var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    //        var lng = Cesium.Math.toDegrees(cartographic.longitude);
    //        var lat = Cesium.Math.toDegrees(cartographic.latitude);
    //        var height = cartographic.height;
    //        if (array.length==9) {
    //            //改变第二个点的值
    //            array[3] = lng;
    //            array[4] = lat;
    //            array[5] = height;
    //            //根据一二两个点的位置判断第三个点的位置（比较高度）
    //            if(array[2]>=array[5]){
    //                array[6] = array[0];
    //                array[7] = array[1];
    //                array[8] = array[5];
    //            }else{
    //                array[6] = array[3];
    //                array[7] = array[4];
    //                array[8] = array[2];
    //            }
    //            polylines.get(polylines.length-1).positions=Cesium.Cartesian3.fromDegreesArrayHeights(array);
    //        }
    //        if(!labels){
    //            labels = that.primitives.add(new Cesium.LabelCollection());
    //            labels.name = "draw_label";
    //            labels.add({
    //                text : '左键单击开始绘制，右键单击结束绘制',
    //                font : '16px sans-serif',
    //                showBackground : true
    //            });
    //            labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
    //        }else{
    //            labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(lng,lat,height);
    //        }
    //        that._labels_=labels;
    //    },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    //    this.handler.setInputAction(function(p){
    //        that.measureEnd();
    //    },Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };
    /**
     * 显示三角测量结果
     */
    MeasureHeightWidget.prototype.measureEnd= function(){
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //$("#monomer-content").children().removeClass("active");
        //绘制完成,清除提示
        if(this._labels_){
            this.primitives.remove(this._labels_);
            this._labels_ =null;
        }
        //var temp = Cesium.Cartesian3.fromDegreesArrayHeights(array);

        //水平距离(m)
        var horizontalDistance= turf.distance(turf.point([this._array_ [0], this._array_ [1]]), turf.point([this._array_ [3], this._array_ [4]]))*1000;
        var temp = [];
        temp.push((this._array_ [0]+this._array_ [3])/2);
        temp.push((this._array_ [1]+this._array_ [4])/2);
        if(this._array_ [2]>=this._array_ [5]){
            temp.push(this._array_ [5]);
        }else{
            temp.push(this._array_ [2]);
        }
        var result;
        if(horizontalDistance<1000){
            result = "水平距离："+horizontalDistance.toFixed(2)+"m";
        }else{
            result = "水平距离："+(horizontalDistance/1000).toFixed(2)+"km";
        }
        createResultLabel(this.primitives,result,temp);

        //垂直高度(m)
        var verticalHeight =Math.abs(this._array_ [2]-this._array_ [5]);
        var temp = [];
        if(this._array_ [2]>=this._array_ [5]){
            temp.push(this._array_ [0]);
            temp.push(this._array_ [1]);
        }else{
            temp.push(this._array_ [3]);
            temp.push(this._array_ [4]);
        }
        temp.push((this._array_ [2]+this._array_ [5])/2);
        var result;
        if(verticalHeight<1000){
            result = "垂直高度："+verticalHeight.toFixed(2)+"m";
        }else{
            result = "垂直高度："+(verticalHeight/1000).toFixed(2)+"km";
        }
        createResultLabel(this.primitives,result,temp);
        //空间距离
        var temp = [];
        temp.push((this._array_ [0]+this._array_ [3])/2);
        temp.push((this._array_ [1]+this._array_ [4])/2);
        temp.push((this._array_ [2]+this._array_ [5])/2);
        var result;
        var spaceDistance = Math.sqrt(Math.pow(horizontalDistance,2)+Math.pow(verticalHeight,2));
        if(spaceDistance<1000){
            result = "空间距离："+spaceDistance.toFixed(2)+"m";
        }else{
            result = "空间距离："+(spaceDistance/1000).toFixed(2)+"km";
        }
        createResultLabel(this.primitives,result,temp);
    }
    /**
     * 清除量算结果
     */
    MeasureHeightWidget.prototype.clear = function(){
        this.handler = this.handler && this.handler.destroy();
        this.viewer.canvas.style.cursor = "default";
        //清除 绘制痕迹
        clearPrimitiveByName("result_label",this.primitives);
        clearPrimitiveByName("draw_label",this.primitives);
        clearPrimitiveByName("draw_polyline",this.primitives);
    };
    //生成结果label
    function createResultLabel(primitives,result,array){
        //生成显示结果的label
        var labels = primitives.add(new Cesium.LabelCollection());
        labels.name = "result_label";
        labels.add({
            text : result,
            font : '16px sans-serif',
            showBackground : true
        });
        labels.get(labels.length-1).position = Cesium.Cartesian3.fromDegrees(array[array.length-3],array[array.length-2],array[array.length-1]);
    }
    //清除primitive绘制痕迹
    function clearPrimitiveByName(name,primitives){
        for(var i=0;i<primitives.length;i++){
            if(primitives.get(i).name==name){
                primitives.remove(primitives.get(i));
                i--;
            }
        }
    }
})(window.Cesium);
/**
 * Class: Cesium.Map
 * 三维地图类。
 */
(function(Cesium){
	"use strict";
	
    /**
     * Map类，Cesium的{@link Viewer}的扩展类，用法与使用Cesium的{@link Viewer}一致。不同的是修改了构造函数的部分参数选项的默认值。
     *
     * @alias Map
     * @constructor
     *
     * @param {Element|String} container 包含三维球的dom元素或id。
     * @param {Object} [options] 参数选项:
     * @param {Boolean} [options.baseLayerPicker=false] 默认为false，Cesium的基础图层组件是否显示。
     * @param {Boolean} [options.timeline=false] 默认为false，Cesium的时间轴组件是否显示。
     * @param {Boolean} [options.animation=false] 默认为false，Cesium的Animation组件是否显示。
     * @param {Boolean} [options.homeButton=false] 默认为false，Cesium的HomeButton组件是否显示。
     * @param {Boolean} [options.navigationHelpButton=false] 默认为false， Cesium的导航帮助按钮是否显示。
     * @param {Boolean} [options.orderIndependentTranslucency=false] 默认为false。
     * @param {SceneMode} [options.sceneMode=SceneMode.SCENE3D] 初始场景模式。
     * @param {Boolean} [options.scene3DOnly=true] 当默认为 <code>true</code>, 几何对象将在3D模式下使用GPU绘制。
     * @param {Number} [options.maxLevel=25] 最大级别数。
     * @param {Boolean} [options.geocoder=false] 默认为false， Cesium的Geocoder组件是否显示。
     * @param {Boolean} [options.fullscreenButton=false] 默认为false，全屏组件是否显示。
     * @param {ImageryProvider} [options.imageryProvider=new SingleTileImageryProvider()] 默认使用一张全球图片的imageryProvider。
     * 
     * @example
     * //初始化三维球
     * var viewer = new Cesium.Map('cesiumContainer');
     */
	Cesium.Map = function(container, options){
		options = options || {};
		options.baseLayerPicker = Cesium.defaultValue(options.baseLayerPicker, false);
		options.timeline = Cesium.defaultValue(options.timeline, false);
		options.animation = Cesium.defaultValue(options.animation, false);
		options.homeButton = Cesium.defaultValue(options.homeButton, false);
		options.navigationHelpButton = Cesium.defaultValue(options.navigationHelpButton, false);
		options.orderIndependentTranslucency = Cesium.defaultValue(options.orderIndependentTranslucency, false);
		options.sceneMode = Cesium.defaultValue(options.sceneMode, Cesium.SceneMode.SCENE3D);//Cesium.SceneMode.SCENE2D,Cesium.SceneMode.SCENE3D
		options.scene3DOnly = Cesium.defaultValue(options.scene3DOnly, true);
		options.maxLevel = Cesium.defaultValue(options.maxLevel, 25);
		options.geocoder = Cesium.defaultValue(options.geocoder, false);
		options.fullscreenButton = Cesium.defaultValue(options.fullscreenButton, false);
		
		//没有传入imageryProvider，则默认使用一张全球图片的imageryProvider
		if (!Cesium.defined(options.imageryProvider)) {
			var scriptSrc = getScriptLocation();//获取"Cesium.js"所在的目录
			var skin_imageryProvider = new Cesium.SingleTileImageryProvider({
				url: scriptSrc + 'Assets/images/Earth.jpg',
				rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180, 90.0)
			});
			options.imageryProvider = skin_imageryProvider;
		}
		//options.imageryProvider = Cesium.defaultValue(options.imageryProvider, new Cesium.UrlTemplateImageryProvider({url:''}));
		
        var map = new Cesium.Viewer(container, options);
		//上一步实例化时创建了一个空的图层，现在再删掉
		//保证一个不带图层的球体能够显示
		//if(options.imageryProvider !== undefined){
		//	map.imageryLayers.removeAll();
		//}
		
		return map;
	};
	
//	Cesium.Viewer.prototype._addTest = function(){
//	};

	//获取"Cesium.js"所在的目录
	function getScriptLocation() {
		var scriptName = "Cesium.js";
        var scriptLocation = "";
        var isGV = new RegExp("(^|(.*?\\/))(" + scriptName + ")(\\?|$)");

        var scripts = document.getElementsByTagName('script');
        for (var i=0, len=scripts.length; i<len; i++) {
            var src = scripts[i].getAttribute('src');
            if (src) {
                var match = src.match(isGV);
                if(match) {
                    scriptLocation = match[1];
                    break;
                }
            }
        }
        return scriptLocation;
    }
	
})(window.Cesium);

/**
 * Class: Cesium.GeoTerrainProvider
 * 三维地形类。
 */
(function(Cesium){
	"use strict";
	
	var GeoTerrainProvider = Cesium.GeoTerrainProvider = function(options) {
        options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);
        if (!Cesium.defined(options.urls)) {
            throw new Cesium.DeveloperError('options.urls is required.');
        }
		//dem数据类型，是int还是float。默认为int。
		this._dataType = Cesium.defaultValue(options.dataType, Cesium.GeoTerrainProvider.INT);

        this._urls = options.urls;
        this._urls_length = this._urls.length;
        this._url_i = 0;
        this._url_step = 0;
        this._maxTerrainLevel = options.maxTerrainLevel-1;
        //if (this._url.length > 0 && this._url[this._url.length - 1] !== '/') {
        //    this._url += '/';
        //}

        this._errorEvent = new Cesium.Event();
        this._ready = false;
        this._readyPromise = Cesium.when.defer();

        this._proxy = options.proxy;

        this._terrainDataStructure = {
                heightScale : 1.0 / 1000.0,
                heightOffset : -1000.0,
                elementsPerHeight : 3,
                stride : 4,
                elementMultiplier : 256.0,
                isBigEndian : true
            };

        var credit = options.credit;
        if (typeof credit === 'string') {
            credit = new Cesium.Credit(credit);
        }
        this._credit = credit;

        this._tilingScheme = undefined;
        this._rectangles = [];

        var ellipsoid = Cesium.defaultValue(options.ellipsoid, Cesium.Ellipsoid.WGS84);
		this._tilingScheme = new Cesium.GeographicTilingScheme({ ellipsoid : ellipsoid });
        this._heightmapWidth = 64;//parseInt(tileFormat.getAttribute('width'), 10);
        this._heightmapHeight = 64;//parseInt(tileFormat.getAttribute('height'), 10);
        this._levelZeroMaximumGeometricError = Cesium.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(ellipsoid, Math.min(this._heightmapWidth, this._heightmapHeight), this._tilingScheme.getNumberOfXTilesAtLevel(0));
        this._ready = true;
        this._readyPromise.resolve(true);
        this._name = options.name;
        this._opacity = options.opacity;
        this._maxExtent = options.maxExtent;
        this._topLevel = options.topLevel;
        this._bottomLevel = options.bottomLevel;
	};

	Cesium.defineProperties(GeoTerrainProvider.prototype, {
	    /**
	     * Gets an event that is raised when the terrain provider encounters an asynchronous error.  By subscribing
	     * to the event, you will be notified of the error and can potentially recover from it.  Event listeners
	     * are passed an instance of {@link TileProviderError}.
	     * @memberof GeoTerrainProvider.prototype
	     * @type {Event}
	     */
	    errorEvent : {
	        get : function() {
	            return this._errorEvent;
	        }
	    },
	
	    /**
	     * Gets the credit to display when this terrain provider is active.  Typically this is used to credit
	     * the source of the terrain.  This function should not be called before {@link GeoTerrainProvider#ready} returns true.
	     * @memberof GeoTerrainProvider.prototype
	     * @type {Credit}
	     */
	    credit : {
	        get : function() {
	            return this._credit;
	        }
	    },
	
	    /**
	     * Gets the tiling scheme used by this provider.  This function should
	     * not be called before {@link GeoTerrainProvider#ready} returns true.
	     * @memberof GeoTerrainProvider.prototype
	     * @type {GeographicTilingScheme}
	     */
	    tilingScheme : {
	        get : function() {
	            if (!this.ready) {
	                throw new Cesium.DeveloperError('requestTileGeometry must not be called before ready returns true.');
	            }
	
	            return this._tilingScheme;
	        }
	    },
	
	    /**
	     * Gets a value indicating whether or not the provider is ready for use.
	     * @memberof GeoTerrainProvider.prototype
	     * @type {Boolean}
	     */
	    ready : {
	        get : function() {
	            return this._ready;
	        }
	    },
	
	    /**
	     * Gets a promise that resolves to true when the provider is ready for use.
	     * @memberof GeoTerrainProvider.prototype
	     * @type {Promise.<Boolean>}
	     * @readonly
	     */
	    readyPromise : {
	        get : function() {
	            return this._readyPromise.promise;
	        }
	    },
	
	    /**
	     * Gets a value indicating whether or not the provider includes a water mask.  The water mask
	     * indicates which areas of the globe are water rather than land, so they can be rendered
	     * as a reflective surface with animated waves.  This function should not be
	     * called before {@link GeoTerrainProvider#ready} returns true.
	     * @memberof GeoTerrainProvider.prototype
	     * @type {Boolean}
	     */
	    hasWaterMask : {
	        get : function() {
	            return false;
	        }
	    },
	
	    /**
	     * Gets a value indicating whether or not the requested tiles include vertex normals.
	     * This function should not be called before {@link GeoTerrainProvider#ready} returns true.
	     * @memberof GeoTerrainProvider.prototype
	     * @type {Boolean}
	     */
	    hasVertexNormals : {
	        get : function() {
	            return false;
	        }
	    }
	});
	
	 //zhangli,获取瓦片url
	GeoTerrainProvider.prototype.requestTileGeometry = function(x, y, level, throttleRequests){
	     //console.log("requestTileGeometry  x: %d;   y: %d ;   level: %d", x, y, level);
	     if (!this.ready) {
	         throw new Cesium.DeveloperError('requestTileGeometry must not be called before ready returns true.');
	     }
		 
	     //urls个数大于1时
		 if(this._urls_length > 1){
		 	 //urlToUse = this._urls[0];
		     //一个链接连续发8个请求，然后换下个链接
		     if (this._url_step < 8) {
		         this._url_step++;
		     }
		     else {
		         this._url_step = 0;
		         this._url_i++;
		         if (this._url_i >= this._urls_length) {
		             this._url_i = 0;
		         }
		     }
		 }
	     var urlToUse = this._urls[this._url_i];
	     
	     var yTiles = this._tilingScheme.getNumberOfYTilesAtLevel(level);
	     //var url = urlToUse + level + '/' + x + '/' + (yTiles - y - 1) + '.tif?cesium=true';
	     if (level < 25 && level >= 2)//level === 2 ||level === 6 ||level === this._maxTerrainLevel || ((level>6)&&(level<this._maxTerrainLevel)&&((level-6)%3===0)))
	     {
			var paramSplit = urlToUse.indexOf('?') === -1 ? '?' : '&';
	        var url = urlToUse + paramSplit + 'x=' + x + '&y=' + y + '&l=' + (level + 1);//
	         //console.log(url);
	         
	         //如果有代理，则加上代理地址
	         var proxy = this._proxy;
	         if (Cesium.defined(proxy)) {
	             url = proxy.getURL(url);
	         }
	         //console.log("proxy url:" + url);
	         var promise;
	         
	         throttleRequests = Cesium.defaultValue(throttleRequests, true);
	         if (throttleRequests) {
	         
	             //promise = Cesium.throttleRequestByServer(url, loadZlibTerrain);
				 promise = loadZlibTerrain(url, throttleRequests);
	             if (!Cesium.defined(promise)) {
	                 return undefined;
	             }
	         }
	         else {
	             promise = loadZlibTerrain(url);
	         }
			 
	         var that = this;
	         return Cesium.when(promise, function(zlibData){
	             //转换数据
	             var vhBuffer = that.transformBuffer(zlibData);
	             if (Cesium.defined(vhBuffer)) {
	                 var hmt = new Cesium.HeightmapTerrainData({
	                     buffer: vhBuffer,
	                     width: that._heightmapWidth,
	                     height: that._heightmapHeight,
	                     childTileMask: getChildMask(that, x, y, level),
	                     structure: that._terrainDataStructure
	                 });
	                 hmt._skirtHeight = 6000;
	                 return hmt;
	             }
	             else {
	                 return undefined;
	             }
	         });
	     }
	     else 
	         if (level < 2) {
	             var vWidth = this._heightmapWidth;
	             var vHeight = this._heightmapHeight;
	             
	             var vChildTileMask = getChildMask(this, x, y, level);
	             var vStructure = this._terrainDataStructure;
	             return new Cesium.HeightmapTerrainData({
	                 buffer: this.getvHeightBuffer(),
	                 width: vWidth,
	                 height: vHeight,
	                 childTileMask: vChildTileMask,
	                 structure: vStructure
	             });
	         }
	         else {
	             return undefined;
	         }
	 };
	 
	/**
	 * Gets the maximum geometric error allowed in a tile at a given level.
	 *
	 * @param {Number} level The tile level for which to get the maximum geometric error.
	 * @returns {Number} The maximum geometric error.
	 */
	GeoTerrainProvider.prototype.getLevelMaximumGeometricError = function(level){
	    if (!this.ready) {
	        throw new Cesium.DeveloperError('requestTileGeometry must not be called before ready returns true.');
	    }
	    return this._levelZeroMaximumGeometricError / (1 << level);
	};
	/**
	 * Determines whether data for a tile is available to be loaded.
	 *
	 * @param {Number} x The X coordinate of the tile for which to request geometry.
	 * @param {Number} y The Y coordinate of the tile for which to request geometry.
	 * @param {Number} level The level of the tile for which to request geometry.
	 * @returns {Boolean} Undefined if not supported, otherwise true or false.
	 */
	GeoTerrainProvider.prototype.getTileDataAvailable = function(x, y, level){
	    if (level < 25) {
	        return true;
	    }
	    return undefined;
	};
	
	GeoTerrainProvider.prototype.getvHeightBuffer = function(){
		var vHeightBuffer = this._vHeightBuffer;
		if (!Cesium.defined(vHeightBuffer)) {
	        vHeightBuffer = new Uint8ClampedArray(this._heightmapWidth * this._heightmapHeight * 4);
	        for (var i = 0; i < this._heightmapWidth * this._heightmapHeight * 4;) {
	            vHeightBuffer[i++] = 15;
	            vHeightBuffer[i++] = 66;
	            vHeightBuffer[i++] = 64;
	            vHeightBuffer[i++] = 255;
	        }
			this._vHeightBuffer = vHeightBuffer;
	    }
	    return vHeightBuffer;
	};
	
	//转换buffer数据
	GeoTerrainProvider.prototype.transformBuffer = function(zlibData){
		//this._dataType是int还是float，控制方法交给用户
		//int时  DataSize=2；
		//float时  DataSize=4；
	    var DataSize = 2;
		if(this._dataType === Cesium.GeoTerrainProvider.INT){
			DataSize = 2;
		}else if(this._dataType === Cesium.GeoTerrainProvider.FLOAT){
			DataSize = 4;
		}
		var dZlib = zlibData;
	    if (dZlib.length === 150 * 150 * DataSize) {
	    
	        //创建四字节数组
	        var height_buffer = new ArrayBuffer(DataSize);
	        //创建DateView
	        var height_view = new DataView(height_buffer);
	        
	        var myW = this._heightmapWidth;
	        var myH = this._heightmapHeight;
	        var myBuffer = new Uint8Array(myW * myH * 4);
	        
	        var i_height;
	        var NN, NN_R;
	        var jj_n, ii_n;
	        var jj_f, ii_f;
	        for (var jj = 0; jj < myH; jj++) {
	            for (var ii = 0; ii < myW; ii++) {
	                jj_n = parseInt((149 * jj) / (myH - 1));
	                ii_n = parseInt((149 * ii) / (myW - 1));
	                
	                jj_f = (149.0 * jj) / (myH - 1);
	                ii_f = (149.0 * ii) / (myW - 1);
	                
	                //如果是float型使用dataview帮忙解析
	                if (DataSize === 4) {
	                    NN = DataSize * (jj_n * 150 + ii_n);
	                    height_view.setInt8(0, dZlib[NN]);
	                    height_view.setInt8(1, dZlib[NN + 1]);
	                    height_view.setInt8(2, dZlib[NN + 2]);
	                    height_view.setInt8(3, dZlib[NN + 3]);
	                    i_height = height_view.getFloat32(0, true);
	                    
	                }
	                else //int型也可以使用dataview解析，以后可以改掉
	                {
	                    //NN = DataSize * (jj * 150 + ii);
	                    NN = DataSize * (jj_n * 150 + ii_n);
	                    i_height = dZlib[NN] + (dZlib[NN + 1] * 256);
	                }
	                
	                //定个范围，在地球上高程应都在-1000——10000之间
	                if (i_height > 10000 || i_height < -2000) {
	                    i_height = 0;
	                }
	                /*
	                 NN = 2 * (jj_n * 150 + ii_n);
	                 //NN = 2 * (jj * 150 + ii);
	                 i_height = dZlib[NN] + (dZlib[NN + 1] * 256);
	                 if (i_height > 10000 || i_height < 0) {
	                 i_height = 0;
	                 }
	                 */
	                //数据结果整理成Cesium内部形式
	                NN_R = (jj * myW + ii) * 4;
	                //Cesium内部就是这么表示的
	                var i_height_new = (i_height + 1000) / 0.001;
	                myBuffer[NN_R] = i_height_new / (256 * 256);
	                myBuffer[NN_R + 1] = (i_height_new - myBuffer[NN_R] * 256 * 256) / 256;
	                myBuffer[NN_R + 2] = i_height_new - myBuffer[NN_R] * 256 * 256 - myBuffer[NN_R + 1] * 256;
	                myBuffer[NN_R + 3] = 255;
	            }
	        }
	        //deferred.resolve(myBuffer);
	        return myBuffer;
	    }
	    else {
	        //deferred.reject(undefined);
			return null;
	    }
	};
	
	function loadZlibTerrain(url, request) {
		var request = Cesium.defined(request) ? request : new Cesium.Request();
		request.url = url;
        request.requestFunction = function() {
			var method_new = 'GET';
			//url = "http://t0.tianditu.com/DataServer?T=elv_c&x=418&y=87&l=9";
			var xhr = new XMLHttpRequest();
			xhr.open(method_new, url, true);
			xhr.responseType = 'arraybuffer';
			xhr.async = false;
			xhr.send(null);
			//console.log("-------------------------设置发送x."+x+"  y."+y+"  l."+level);
			return createBuffer(xhr);
		
            //var deferred = when.defer();
            //var xhr = loadWithXhr.load(url, responseType, method, data, headers, deferred, overrideMimeType);
            //if (defined(xhr) && defined(xhr.abort)) {
            //    request.cancelFunction = function() {
            //        xhr.abort();
            //    };
            //}
            //return deferred.promise;
        };
        return Cesium.RequestScheduler.request(request);
	}
	
	function createBuffer(xhr, url, allowCrossOrigin){
	    var deferred = Cesium.when.defer();
	    xhr.onreadystatechange = function(){
	        //console.log('=================return  xhr.status:'+xhr.status);
	        if (xhr.readyState === 4) {
	            //console.log('=================return  xhr.status:'+xhr.status);
	            if (xhr.status === 200) {
	                //console.log(xhr.responseURL + '=================return');
	                
	                if (Cesium.defined(xhr.response)) {
	                    var view = new DataView(xhr.response);
	                    var zBuffer = new Uint8Array(view.byteLength);
	                    var index = 0;
	                    while (index < view.byteLength) {
	                        zBuffer[index] = view.getUint8(index, true);
	                        index++;
	                    }
						//解压数据
	                    var dZlib = decZlibBuffer(zBuffer);
	                    if (!Cesium.defined(dZlib)) {
	                        // console.log(xhr.responseURL + '========bad dzlib return');
	                        deferred.reject(undefined);
	                    }
	                    else {
	                        deferred.resolve(dZlib);
	                    }
	                }
	                else {
	                    /*
	                     // busted old browsers.
	                     if (Cesium.defined(xhr.responseXML) && xhr.responseXML.hasChildNodes()) {
	                     Cesium.deferred.resolve(xhr.responseXML);
	                     } else if (Cesium.defined(xhr.responseText)) {
	                     Cesium.deferred.resolve(xhr.responseText);
	                     } else {
	                     Cesium.deferred.reject(new Cesium.RuntimeError('unknown XMLHttpRequest response type.'));
	                     }*/
	                    //deferred.reject(undefined);
	                }
	            }
	            else {
	                //deferred.reject(undefined);
	            }
	        }
	    };
	    return deferred.promise;
	}
	
	//解压数据
	function decZlibBuffer(zBuffer){
	    if (zBuffer.length < 1000) {
	        return undefined;
	    }
	    var inflate = new Zlib.Inflate(zBuffer);
	    
	    if (Cesium.defined(inflate)) {
	        return inflate.decompress();
	    }
	    else {
	        return undefined;
	    }
	}
	 
	var rectangleScratch = new Cesium.Rectangle();
	function getChildMask(provider, x, y, level){
	    var tilingScheme = provider._tilingScheme;
	    var rectangles = provider._rectangles;
	    var parentRectangle = tilingScheme.tileXYToRectangle(x, y, level);
	    
	    var childMask = 0;
	    
	    for (var i = 0; i < rectangles.length && childMask !== 15; ++i) {
	        var rectangle = rectangles[i];
	        if (rectangle.maxLevel <= level) {
	            continue;
	        }
	        
	        var testRectangle = rectangle.rectangle;
	        
	        var intersection = Cesium.Rectangle.intersection(testRectangle, parentRectangle, rectangleScratch);
	        if (Cesium.defined(intersection)) {
	            // Parent tile is inside this rectangle, so at least one child is, too.
	            if (isTileInRectangle(tilingScheme, testRectangle, x * 2, y * 2, level + 1)) {
	                childMask |= 4; // northwest
	            }
	            if (isTileInRectangle(tilingScheme, testRectangle, x * 2 + 1, y * 2, level + 1)) {
	                childMask |= 8; // northeast
	            }
	            if (isTileInRectangle(tilingScheme, testRectangle, x * 2, y * 2 + 1, level + 1)) {
	                childMask |= 1; // southwest
	            }
	            if (isTileInRectangle(tilingScheme, testRectangle, x * 2 + 1, y * 2 + 1, level + 1)) {
	                childMask |= 2; // southeast
	            }
	        }
	    }
	    return childMask;
	}
	
	function isTileInRectangle(tilingScheme, rectangle, x, y, level) {
	    var tileRectangle = tilingScheme.tileXYToRectangle(x, y, level);
	    return Cesium.defined(Cesium.Rectangle.intersection(tileRectangle, rectangle, rectangleScratch));
	}
	
	GeoTerrainProvider.INT = "int";
	GeoTerrainProvider.FLOAT = "float";

})(window.Cesium);
(function(Cesium){
	"use strict";

	var defaultValue = Cesium.defaultValue;
    var defined = Cesium.defined;

	/**
     * 3d tiles单体化类。
     *
     * @alias Cesium3DTilesetMonomer
     * @constructor
     *
     * @param {Object} [options] 参数选项:
     * @param {Viewer} [options.viewer] 三维球对象。
     * @param {Cesium3DTileset} [options.tileset] 3d tiles对象。
     * @param {Object} [options.source] 数据源对象。
     * @param {String} [options.source.type] 数据源类型，值一般为"geojson"。
     * @param {String|Object} [options.source.data] 如果type为"geojson"，则一般设置为一个url, GeoJSON对象或TopoJSON对象。
     *
     * @example
     * var tilesetMonomer = new Cesium.Cesium3DTilesetMonomer({
     *      viewer : viewer,
     *      tileset : tileset,
     *      source : {
     *      	type: "geojson",
     *      	data: "data/fj_geojson/fj.geojson"
     *      }
     * });
     *
     * @example
     * var tilesetMonomer = new Cesium.Cesium3DTilesetMonomer({
     *      viewer : viewer,
     *      tileset : tileset,
     *      source : {
     *      	type: "geojson",
     *      	data: {"type":"FeatureCollection", "features": [{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[108.95908735739037,34.220151116008616],[108.95974335343854,34.22015701200698],[108.95974050128187,34.219553259627006],[108.95908878346874,34.219547363586436],[108.95908735739037,34.220151116008616]]]},"properties":{"Id":0,"minheight":400,"maxheight":490,"desc":"大雁塔","name":"大雁塔"}}]}
     *      }
     * });
     * //选中要素事件回调
     * tilesetMonomer.seletedEvent.addEventListener(function(feature) {
     *
     * }, tilesetMonomer);
     */
	function Cesium3DTilesetMonomer(options){
		options = defaultValue(options, defaultValue.EMPTY_OBJECT);
		this.viewer = options.viewer;
		this.tileset = options.tileset;//this.tileset = new Cesium.Cesium3DTileset(options);
		this.source = options.source;
		this.autoActivate = defaultValue(options.autoActivate, true);
		this.active = defaultValue(options.active, null);
		this.showDefaultSelectedEntity = defaultValue(options.showDefaultSelectedEntity, true);
		//this.onSelect = defaultValue(options.onSelect, function(){});
		this.originalColor = defaultValue(options.originalColor, Cesium.Color.fromBytes(255, 50, 50, 1));//接近透明
		this.moveColor = defaultValue(options.moveColor, Cesium.Color.fromBytes(255, 50, 50, 122));//移动时的颜色
		this.selectedColor = defaultValue(options.selectedColor, Cesium.Color.fromBytes(50, 255, 50, 122));//绿色
		this.selectedFeature = undefined;//点击选中feature
		this.dataSource = undefined;
		this.selectedEntity = new Cesium.Entity();
		this.wrappedBoxDataSource = undefined; //完整包裹3DTileset的数据对象

		//geojson数据源
		if(this.source && this.source.type === "geojson"){
			this._loadGeoJSON(this.source.data);
		}

		//屏幕空间事件处理器
		this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
		//是否自动激活
		if(this.autoActivate){
			this.activateAction();
		}

		this._seletedEvent = new Cesium.Event();
	}


	Cesium.defineProperties(Cesium3DTilesetMonomer.prototype, {
		/**
         * Cesium球体对象。
         * @name viewer
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {Viewer}
         */

		/**
         * Cesium3DTileset对象。
         * @name tileset
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {Cesium3DTileset}
         */

		/**
         * 是否自动激活。默认true。
         * @name autoActivate
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {Boolean}
         * @default true
         */

		/**
         * 激活状态。
         * @name active
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {Boolean}
         * @default null
         */

		/**
         * 选择某个模型要素时，是否显示默认信息框。
         * @name showDefaultSelectedEntity
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {Boolean}
         * @default true
         */

		/**
         * 移动时，要素的颜色。
         * @name moveColor
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {Color}
         * @default Cesium.Color.fromBytes(255, 50, 50, 122)
         */

		/**
         * 选中时，要素的颜色。
         * @name selectedColor
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {Color}
         * @default Cesium.Color.fromBytes(50, 255, 50, 122)
         */

		/**
         * geojson数据源对象。
         * @name dataSource
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {GeoJsonDataSource}
         */

		/**
         * 获取选中事件。
         * @memberof Cesium3DTilesetMonomer.prototype
         * @type {Event}
         */
        seletedEvent : {
            get : function() {
                return this._seletedEvent;
            }
        }
	});

    /**
     * @private
     * 创建一个新的Promise实例，在加载完毕后，提供GeoJSON或TopoJSON数据。然后添加至viewer。
     *
     * @param {String|Object} data 一个url, GeoJSON对象或TopoJSON对象。
     *
     */
	Cesium3DTilesetMonomer.prototype._loadGeoJSON = function(data){
		//@returns {Promise.<GeoJsonDataSource>} 当数据被加载完毕时，一个promise将resolve。
		var pro = Cesium.GeoJsonDataSource.load(data);
		var $this1 = this;
		pro.then(function(dataSource) {
			$this1.dataSource = dataSource;
			$this1.viewer.dataSources.add(dataSource);
			var entities = dataSource.entities.values;
	        for (var i = 0; i < entities.length; i++) {
	            var entity = entities[i];
	            //var name = entity.name;
	            var color = $this1.originalColor;//近乎透明的红色
	            entity.polygon.material = color;
	            entity.polygon.outline = false;
	            entity.polygon.height = entity.properties.minheight;
	            entity.polygon.extrudedHeight = entity.properties.maxheight;
	        }
		});
	};

    /**
     * 重新加载GeoJSON或TopoJSON数据。然后添加至viewer。
     *
     * @param {String|Object} data 一个url, GeoJSON对象或TopoJSON对象。
     *
     */
	Cesium3DTilesetMonomer.prototype.reloadGeoJSON = function(data){
		this.dataSource = this.viewer.dataSources.remove(this.dataSource) ? null : this.dataSource;
		this._loadGeoJSON(data);
	};

    /**
     * 显示Cesium信息框。
     *
     * @param {Object} pickedFeature 要素对象。
     *
     */
	Cesium3DTilesetMonomer.prototype.showSelectedEntity = function(pickedFeature){
		if (pickedFeature && pickedFeature.id) {
			//显示信息框
			this.selectedEntity.name = pickedFeature.id.name;
			//selectedEntity.description = 'Loading <div class="cesium-infoBox-loading"></div>';
			this.viewer.selectedEntity = this.selectedEntity;
			//pickedFeature.id.properties.getValue(0);
			//字段名称
			var propertyNames = pickedFeature.id.properties.propertyNames;
			var selectedEntity_htmlStr = '<table class="cesium-infoBox-defaultTable"><tbody>';
			for (var i = 0; i < propertyNames.length; i++) {
				selectedEntity_htmlStr += '<tr><th>' + propertyNames[i] + '</th><td>' + pickedFeature.id.properties[propertyNames[i]].getValue() + '</td></tr>';
			}
			selectedEntity_htmlStr += '</tbody></table>';
			this.selectedEntity.description = selectedEntity_htmlStr;
		}
	};

	//Cesium3DTilesetMonomer.prototype.onSelect = function(pickedFeature){};

    /**
     * dataSource内是否包含模型要素。
     *
     * @param {Object} pickedFeature 模型要素对象。
     *
     */
	Cesium3DTilesetMonomer.prototype.isContaintFeature = function(pickedFeature){
		var entities_values = this.dataSource.entities.values;
		for (var i = 0; i < entities_values.length; i++) {
			if(entities_values[i] === pickedFeature.id){
				return true;
			}
		}
		return false;
	};

	/**
     * 显示模型额外的完整包裹几何体
     *
     * @param {Object} data GeoJSON对象或TopoJSON对象。
     *
     */
	Cesium3DTilesetMonomer.prototype.showWrappedBox = function(data){
        var $this1 = this;
        $this1.hideWrappedBox();
        var pro = Cesium.GeoJsonDataSource.load(data);
        pro.then(function(dataSource) {
            $this1.viewer.dataSources.add(dataSource);
            var entities = dataSource.entities.values;
            for (var i = 0; i < entities.length; i++) {
                var entity = entities[i];
                var color = $this1.selectedColor;
                entity.polygon.material = color;
                entity.polygon.outline = false;
                entity.polygon.height = entity.properties.minheight;
                entity.polygon.extrudedHeight = entity.properties.maxheight;
            }
            $this1.wrappedBoxDataSource = dataSource;
        });
	};

	/**
     * 隐藏模型额外的完整包裹几何体
     */
    Cesium3DTilesetMonomer.prototype.hideWrappedBox = function(){
        if(this.wrappedBoxDataSource){
            this.viewer.dataSources.remove(this.wrappedBoxDataSource);
            this.wrappedBoxDataSource = undefined;
        }
    };

    /**
     * 激活动作。
     */
	Cesium3DTilesetMonomer.prototype.activateAction = function(){
		if(this.active === true){
			return;
		}
		this.active = true;
		var $this1 = this;

		this._showDataSource(true);

		//var highlightedFeature = null;//移动高亮feature
		var movedFeature = null;//移动高亮feature
		var selectedFeature = null;//点击选中feature
		//var selectedEntity = new Cesium.Entity();

		//鼠标移动时，高亮模型
		$this1.handler.setInputAction(function(e){
			//恢复原色
			if(movedFeature && movedFeature.id){
				if(selectedFeature && selectedFeature.id && movedFeature && movedFeature.id && movedFeature.id.id === selectedFeature.id.id){
					return;
				}
				movedFeature.id.polygon.material = $this1.originalColor;
		        movedFeature = undefined;
			}
			var pickedFeature = $this1.viewer.scene.pick(e.endPosition);
		    if (!Cesium.defined(pickedFeature)) {
		        return;
		    }

			//1.没有已选择selectedFeature的时候
			//2.已选择的selectedFeature和点中的pickedFeature不相同时
			if (
			(!selectedFeature && pickedFeature && pickedFeature.id) ||
			(pickedFeature && pickedFeature.id && selectedFeature && selectedFeature.id && (pickedFeature.id.id !== selectedFeature.id.id))
			) {
				//验证dataSource内是否包含pickedFeature
				if(!$this1.isContaintFeature(pickedFeature)){
					return;
				}
				movedFeature = pickedFeature;
				pickedFeature.id.polygon.material = $this1.moveColor;
			}


		}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

		//高亮选中
		//var clickFn = $this1.handler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
		$this1.handler.setInputAction(function(e){
			//恢复原色
			if(selectedFeature){
				selectedFeature.id.polygon.material = $this1.originalColor;
				selectedFeature = undefined;
				$this1.selectedFeature = selectedFeature;
			}
			var pickedFeature = $this1.viewer.scene.pick(e.position);
			if (!Cesium.defined(pickedFeature)) {
		        //clickFn(e);
				$this1.viewer.selectedEntity = null;
		        return;
		    }
			if (selectedFeature === pickedFeature) {
		        return;
		    }
			if(pickedFeature && pickedFeature.id && (selectedFeature !== pickedFeature)){
				//验证dataSource内是否包含pickedFeature
				if(!$this1.isContaintFeature(pickedFeature)){
					return;
				}
				selectedFeature = pickedFeature;
				pickedFeature.id.polygon.material = $this1.selectedColor;
				$this1.selectedFeature = selectedFeature;
			}

			if (pickedFeature && selectedFeature && movedFeature && pickedFeature.id === movedFeature.id) {
		        //Cesium.Color.clone(highlighted.originalColor, selected.originalColor);
		        //movedFeature = undefined;
		        movedFeature = undefined;
		    }

			if(pickedFeature && pickedFeature.id){
				//是否显示默认的信息框
				if($this1.showDefaultSelectedEntity){
					$this1.showSelectedEntity(pickedFeature);
				}else{
					$this1.viewer.selectedEntity = null;
				}
				//$this1.onSelect.call($this1, pickedFeature);
				$this1._seletedEvent.raiseEvent(pickedFeature);
			}else{
				$this1.viewer.selectedEntity = null;
			}



		}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
	};

    /**
     * 关闭动作。
     */
	Cesium3DTilesetMonomer.prototype.deactivateAction = function(){
		if(this.active !== true){
			return;
		}
		this.active = false;
		var $this1 = this;
		//$this1.handler.setInputAction(function(e){}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
		//var clickFn = $this1.handler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
		if($this1.selectedFeature && $this1.selectedFeature.id){
			$this1.selectedFeature.id.polygon.material = $this1.originalColor;
			$this1.selectedFeature = null;
			$this1.viewer.selectedEntity = null;
		}
		$this1.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
		$this1.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);

		this._showDataSource(false);
	};

    /**
     * @private
     * 是否显示加载的geojson数据。
     *
     * @param {Boolean} isshow true或false。是否显示加载的geojson数据。
     */
	Cesium3DTilesetMonomer.prototype._showDataSource = function(isshow){
		if(this.dataSource){
			this.dataSource.show = isshow;
//			var entities = this.dataSource.entities.values;
//	        for (var i = 0; i < entities.length; i++) {
//				var entity = entities[i];
//				entity.show = isshow;
//			}
		}
	};

    /**
     * 销毁。
     */
	Cesium3DTilesetMonomer.prototype.destroy = function(){
		this.deactivateAction();
		this.handler = this.handler && this.handler.destroy();
		this.dataSource = this.viewer.dataSources.remove(this.dataSource) ? null : this.dataSource;
		this.viewer = undefined;
		this.tileset = undefined;
		this.source = undefined;
		this.originalColor = undefined;
		this.moveColor = undefined;
		this.selectedColor = undefined;
		this.selectedFeature = undefined;
		this.selectedEntity = undefined;
	};

	Cesium.Cesium3DTilesetMonomer = Cesium3DTilesetMonomer;

})(window.Cesium);
(function(Cesium){
	"use strict";
	
	/*
	define([
        '../Core/BoundingSphere',
        '../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Core/Cartesian4',
        '../Core/Cartographic',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/EasingFunction',
        '../Core/Ellipsoid',
        '../Core/EllipsoidGeodesic',
        '../Core/Event',
        '../Core/HeadingPitchRange',
        '../Core/HeadingPitchRoll',
        '../Core/Intersect',
        '../Core/IntersectionTests',
        '../Core/Math',
        '../Core/Matrix3',
        '../Core/Matrix4',
        '../Core/OrthographicFrustum',
        '../Core/OrthographicOffCenterFrustum',
        '../Core/PerspectiveFrustum',
        '../Core/Quaternion',
        '../Core/Ray',
        '../Core/Rectangle',
        '../Core/Transforms',
        './CameraFlightPath',
        './MapMode2D',
        './SceneMode'
    ], function(
        BoundingSphere,
        Cartesian2,
        Cartesian3,
        Cartesian4,
        Cartographic,
        defaultValue,
        defined,
        defineProperties,
        DeveloperError,
        EasingFunction,
        Ellipsoid,
        EllipsoidGeodesic,
        Event,
        HeadingPitchRange,
        HeadingPitchRoll,
        Intersect,
        IntersectionTests,
        CesiumMath,
        Matrix3,
        Matrix4,
        OrthographicFrustum,
        OrthographicOffCenterFrustum,
        PerspectiveFrustum,
        Quaternion,
        Ray,
        Rectangle,
        Transforms,
        CameraFlightPath,
        MapMode2D,
        SceneMode) {
*/
    'use strict';
	//文件末尾处定义类名

	var BoundingSphere = Cesium.BoundingSphere;
    var Cartesian2 = Cesium.Cartesian2;
    var Cartesian3 = Cesium.Cartesian3;
    var Cartesian4 = Cesium.Cartesian4;
    var Cartographic = Cesium.Cartographic;
    var defaultValue = Cesium.defaultValue;
    var defined = Cesium.defined;
    var defineProperties = Cesium.defineProperties;
    var DeveloperError = Cesium.DeveloperError;
    var EasingFunction = Cesium.EasingFunction;
    var Ellipsoid = Cesium.Ellipsoid;
    var EllipsoidGeodesic = Cesium.EllipsoidGeodesic;
    var Event = Cesium.Event;
    var HeadingPitchRange = Cesium.HeadingPitchRange;
    var HeadingPitchRoll = Cesium.HeadingPitchRoll;
    var Intersect = Cesium.Intersect;
    var IntersectionTests = Cesium.IntersectionTests;
    var CesiumMath = Cesium.Math;
    var Matrix3 = Cesium.Matrix3;
    var Matrix4 = Cesium.Matrix4;
    var OrthographicFrustum = Cesium.OrthographicFrustum;
    var OrthographicOffCenterFrustum = Cesium.OrthographicOffCenterFrustum;
    var PerspectiveFrustum = Cesium.PerspectiveFrustum;
    var Quaternion = Cesium.Quaternion;
    var Ray = Cesium.Ray;
    var Rectangle = Cesium.Rectangle;
    var Transforms = Cesium.Transforms;
    var CameraFlightPath = Cesium.CameraFlightPath;
    var MapMode2D = Cesium.MapMode2D;
    var SceneMode = Cesium.SceneMode;
    /**
     * The camera is defined by a position, orientation, and view frustum.
     * <br /><br />
     * The orientation forms an orthonormal basis with a view, up and right = view x up unit vectors.
     * <br /><br />
     * The viewing frustum is defined by 6 planes.
     * Each plane is represented by a {@link Cartesian4} object, where the x, y, and z components
     * define the unit vector normal to the plane, and the w component is the distance of the
     * plane from the origin/camera position.
     *
     * @alias Camera
     *
     * @constructor
     *
     * @param {Scene} scene The scene.
     *
     * @demo {@link http://cesiumjs.org/Cesium/Apps/Sandcastle/index.html?src=Camera.html|Cesium Sandcastle Camera Demo}
     * @demo {@link http://cesiumjs.org/Cesium/Apps/Sandcastle/index.html?src=Camera%20Tutorial.html">Sandcastle Example</a> from the <a href="http://cesiumjs.org/2013/02/13/Cesium-Camera-Tutorial/|Camera Tutorial}
     *
     * @example
     * // Create a camera looking down the negative z-axis, positioned at the origin,
     * // with a field of view of 60 degrees, and 1:1 aspect ratio.
     * var camera = new Cesium.Camera(scene);
     * camera.position = new Cesium.Cartesian3();
     * camera.direction = Cesium.Cartesian3.negate(Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3());
     * camera.up = Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_Y);
     * camera.frustum.fov = Cesium.Math.PI_OVER_THREE;
     * camera.frustum.near = 1.0;
     * camera.frustum.far = 2.0;
     */
    function Camera(scene) {
		//console.log("new GeoCamera ing");
        //>>includeStart('debug', pragmas.debug);
        if (!defined(scene)) {
            throw new DeveloperError('scene is required.');
        }
        //>>includeEnd('debug');
        this._scene = scene;

        this._transform = Matrix4.clone(Matrix4.IDENTITY);
        this._invTransform = Matrix4.clone(Matrix4.IDENTITY);
        this._actualTransform = Matrix4.clone(Matrix4.IDENTITY);
        this._actualInvTransform = Matrix4.clone(Matrix4.IDENTITY);
        this._transformChanged = false;

        /**
         * The position of the camera.
         *
         * @type {Cartesian3}
         */
        this.position = new Cartesian3();
        this._position = new Cartesian3();
        this._positionWC = new Cartesian3();
        this._positionCartographic = new Cartographic();

        /**
         * The view direction of the camera.
         *
         * @type {Cartesian3}
         */
        this.direction = new Cartesian3();
        this._direction = new Cartesian3();
        this._directionWC = new Cartesian3();

        /**
         * The up direction of the camera.
         *
         * @type {Cartesian3}
         */
        this.up = new Cartesian3();
        this._up = new Cartesian3();
        this._upWC = new Cartesian3();

        /**
         * The right direction of the camera.
         *
         * @type {Cartesian3}
         */
        this.right = new Cartesian3();
        this._right = new Cartesian3();
        this._rightWC = new Cartesian3();

        /**
         * The region of space in view.
         *
         * @type {Frustum}
         * @default PerspectiveFrustum()
         *
         * @see PerspectiveFrustum
         * @see PerspectiveOffCenterFrustum
         * @see OrthographicFrustum
         */
        this.frustum = new PerspectiveFrustum();
        this.frustum.aspectRatio = scene.drawingBufferWidth / scene.drawingBufferHeight;
        this.frustum.fov = CesiumMath.toRadians(60.0);

        /**
         * The default amount to move the camera when an argument is not
         * provided to the move methods.
         * @type {Number}
         * @default 100000.0;
         */
        this.defaultMoveAmount = 100000.0;
        /**
         * The default amount to rotate the camera when an argument is not
         * provided to the look methods.
         * @type {Number}
         * @default Math.PI / 60.0
         */
        this.defaultLookAmount = Math.PI / 60.0;
        /**
         * The default amount to rotate the camera when an argument is not
         * provided to the rotate methods.
         * @type {Number}
         * @default Math.PI / 3600.0
         */
        this.defaultRotateAmount = Math.PI / 3600.0;
        /**
         * The default amount to move the camera when an argument is not
         * provided to the zoom methods.
         * @type {Number}
         * @default 100000.0;
         */
        this.defaultZoomAmount = 100000.0;
        /**
         * If set, the camera will not be able to rotate past this axis in either direction.
         * @type {Cartesian3}
         * @default undefined
         */
        this.constrainedAxis = undefined;
        /**
         * The factor multiplied by the the map size used to determine where to clamp the camera position
         * when zooming out from the surface. The default is 1.5. Only valid for 2D and the map is rotatable.
         * @type {Number}
         * @default 1.5
         */
        this.maximumZoomFactor = 1.5;

        this._moveStart = new Event();
        this._moveEnd = new Event();

        this._changed = new Event();
        this._changedPosition = undefined;
        this._changedDirection = undefined;
        this._changedFrustum = undefined;

        /**
         * The amount the camera has to change before the <code>changed</code> event is raised. The value is a percentage in the [0, 1] range.
         * @type {number}
         * @default 0.5
         */
        this.percentageChanged = 0.5;

        this._viewMatrix = new Matrix4();
        this._invViewMatrix = new Matrix4();
        updateViewMatrix(this);

        this._mode = SceneMode.SCENE3D;
        this._modeChanged = true;
        var projection = scene.mapProjection;
        this._projection = projection;
        this._maxCoord = projection.project(new Cartographic(Math.PI, CesiumMath.PI_OVER_TWO));
        this._max2Dfrustum = undefined;
        this._suspendTerrainAdjustment = false;

        // set default view
        rectangleCameraPosition3D(this, Camera.DEFAULT_VIEW_RECTANGLE, this.position, true);

        var mag = Cartesian3.magnitude(this.position);
        mag += mag * Camera.DEFAULT_VIEW_FACTOR;
        Cartesian3.normalize(this.position, this.position);
        Cartesian3.multiplyByScalar(this.position, mag, this.position);
    }

    /**
     * @private
     */
    Camera.TRANSFORM_2D = new Matrix4(
        0.0, 0.0, 1.0, 0.0,
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 1.0);

    /**
     * @private
     */
    Camera.TRANSFORM_2D_INVERSE = Matrix4.inverseTransformation(Camera.TRANSFORM_2D, new Matrix4());

    /**
     * The default rectangle the camera will view on creation.
     * @type Rectangle
     */
    Camera.DEFAULT_VIEW_RECTANGLE = Rectangle.fromDegrees(-95.0, -20.0, -70.0, 90.0);

    /**
     * A scalar to multiply to the camera position and add it back after setting the camera to view the rectangle.
     * A value of zero means the camera will view the entire {@link Camera#DEFAULT_VIEW_RECTANGLE}, a value greater than zero
     * will move it further away from the extent, and a value less than zero will move it close to the extent.
     * @type Number
     */
    Camera.DEFAULT_VIEW_FACTOR = 0.5;

    /**
     * The default heading/pitch/range that is used when the camera flies to a location that contains a bounding sphere.
     * @type HeadingPitchRange
     */
    Camera.DEFAULT_OFFSET = new HeadingPitchRange(0.0, -CesiumMath.PI_OVER_FOUR, 0.0);

    function updateViewMatrix(camera) {
        Matrix4.computeView(camera._position, camera._direction, camera._up, camera._right, camera._viewMatrix);
        Matrix4.multiply(camera._viewMatrix, camera._actualInvTransform, camera._viewMatrix);
        Matrix4.inverseTransformation(camera._viewMatrix, camera._invViewMatrix);
    }

    Camera.prototype._updateCameraChanged = function() {
        var camera = this;

        if (camera._changed.numberOfListeners === 0) {
            return;
        }

        var percentageChanged = camera.percentageChanged;

        if (camera._mode === SceneMode.SCENE2D) {
            if (!defined(camera._changedFrustum)) {
                camera._changedPosition = Cartesian3.clone(camera.position, camera._changedPosition);
                camera._changedFrustum = camera.frustum.clone();
                return;
            }

            var position = camera.position;
            var lastPosition = camera._changedPosition;

            var frustum = camera.frustum;
            var lastFrustum = camera._changedFrustum;

            var x0 = position.x + frustum.left;
            var x1 = position.x + frustum.right;
            var x2 = lastPosition.x + lastFrustum.left;
            var x3 = lastPosition.x + lastFrustum.right;

            var y0 = position.y + frustum.bottom;
            var y1 = position.y + frustum.top;
            var y2 = lastPosition.y + lastFrustum.bottom;
            var y3 = lastPosition.y + lastFrustum.top;

            var leftX = Math.max(x0, x2);
            var rightX = Math.min(x1, x3);
            var bottomY = Math.max(y0, y2);
            var topY = Math.min(y1, y3);

            var areaPercentage;
            if (leftX >= rightX || bottomY >= y1) {
                areaPercentage = 1.0;
            } else {
                var areaRef = lastFrustum;
                if (x0 < x2 && x1 > x3 && y0 < y2 && y1 > y3) {
                    areaRef = frustum;
                }
                areaPercentage = 1.0 - ((rightX - leftX) * (topY - bottomY)) / ((areaRef.right - areaRef.left) * (areaRef.top - areaRef.bottom));
            }

            if (areaPercentage > percentageChanged) {
                camera._changed.raiseEvent(areaPercentage);
                camera._changedPosition = Cartesian3.clone(camera.position, camera._changedPosition);
                camera._changedFrustum = camera.frustum.clone(camera._changedFrustum);
            }
            return;
        }

        if (!defined(camera._changedDirection)) {
            camera._changedPosition = Cartesian3.clone(camera.positionWC, camera._changedPosition);
            camera._changedDirection = Cartesian3.clone(camera.directionWC, camera._changedDirection);
            return;
        }

        var dirAngle = CesiumMath.acosClamped(Cartesian3.dot(camera.directionWC, camera._changedDirection));

        var dirPercentage;
        if (defined(camera.frustum.fovy)) {
            dirPercentage = dirAngle / (camera.frustum.fovy * 0.5);
        } else {
            dirPercentage = dirAngle;
        }

        var distance = Cartesian3.distance(camera.positionWC, camera._changedPosition);
        var heightPercentage = distance / camera.positionCartographic.height;

        if (dirPercentage > percentageChanged || heightPercentage > percentageChanged) {
            camera._changed.raiseEvent(Math.max(dirPercentage, heightPercentage));
            camera._changedPosition = Cartesian3.clone(camera.positionWC, camera._changedPosition);
            camera._changedDirection = Cartesian3.clone(camera.directionWC, camera._changedDirection);
        }
    };

    var scratchAdjustHeightTransform = new Matrix4();
    var scratchAdjustHeightCartographic = new Cartographic();

    Camera.prototype._adjustHeightForTerrain = function() {
        var scene = this._scene;

        var screenSpaceCameraController = scene.screenSpaceCameraController;
        var enableCollisionDetection = screenSpaceCameraController.enableCollisionDetection;
        var minimumCollisionTerrainHeight = screenSpaceCameraController.minimumCollisionTerrainHeight;
        var minimumZoomDistance = screenSpaceCameraController.minimumZoomDistance;

        if (this._suspendTerrainAdjustment || !enableCollisionDetection) {
            return;
        }

        var mode = this._mode;
        var globe = scene.globe;

        if (!defined(globe) || mode === SceneMode.SCENE2D || mode === SceneMode.MORPHING) {
            return;
        }

        var ellipsoid = globe.ellipsoid;
        var projection = scene.mapProjection;

        var transform;
        var mag;
        if (!Matrix4.equals(this.transform, Matrix4.IDENTITY)) {
            transform = Matrix4.clone(this.transform, scratchAdjustHeightTransform);
            mag = Cartesian3.magnitude(this.position);
            this._setTransform(Matrix4.IDENTITY);
        }

        var cartographic = scratchAdjustHeightCartographic;
        if (mode === SceneMode.SCENE3D) {
            ellipsoid.cartesianToCartographic(this.position, cartographic);
        } else {
            projection.unproject(this.position, cartographic);
        }

        var heightUpdated = false;
        if (cartographic.height < minimumCollisionTerrainHeight) {
            var height = globe.getHeight(cartographic);
            if (defined(height)) {
                height += minimumZoomDistance;
                if (cartographic.height < height) {
                    cartographic.height = height;
                    if (mode === SceneMode.SCENE3D) {
                        ellipsoid.cartographicToCartesian(cartographic, this.position);
                    } else {
                        projection.project(cartographic, this.position);
                    }
                    heightUpdated = true;
                }
            }
        }

        if (defined(transform)) {
            this._setTransform(transform);
            if (heightUpdated) {
                Cartesian3.normalize(this.position, this.position);
                Cartesian3.negate(this.position, this.direction);
                Cartesian3.multiplyByScalar(this.position, Math.max(mag, minimumZoomDistance), this.position);
                Cartesian3.normalize(this.direction, this.direction);
                Cartesian3.cross(this.direction, this.up, this.right);
                Cartesian3.cross(this.right, this.direction, this.up);
            }
        }
    };

    function convertTransformForColumbusView(camera) {
        Transforms.basisTo2D(camera._projection, camera._transform, camera._actualTransform);
    }

    var scratchCartographic = new Cartographic();
    var scratchCartesian3Projection = new Cartesian3();
    var scratchCartesian3 = new Cartesian3();
    var scratchCartesian4Origin = new Cartesian4();
    var scratchCartesian4NewOrigin = new Cartesian4();
    var scratchCartesian4NewXAxis = new Cartesian4();
    var scratchCartesian4NewYAxis = new Cartesian4();
    var scratchCartesian4NewZAxis = new Cartesian4();

    function convertTransformFor2D(camera) {
        var projection = camera._projection;
        var ellipsoid = projection.ellipsoid;

        var origin = Matrix4.getColumn(camera._transform, 3, scratchCartesian4Origin);
        var cartographic = ellipsoid.cartesianToCartographic(origin, scratchCartographic);

        var projectedPosition = projection.project(cartographic, scratchCartesian3Projection);
        var newOrigin = scratchCartesian4NewOrigin;
        newOrigin.x = projectedPosition.z;
        newOrigin.y = projectedPosition.x;
        newOrigin.z = projectedPosition.y;
        newOrigin.w = 1.0;

        var newZAxis = Cartesian4.clone(Cartesian4.UNIT_X, scratchCartesian4NewZAxis);

        var xAxis = Cartesian4.add(Matrix4.getColumn(camera._transform, 0, scratchCartesian3), origin, scratchCartesian3);
        ellipsoid.cartesianToCartographic(xAxis, cartographic);

        projection.project(cartographic, projectedPosition);
        var newXAxis = scratchCartesian4NewXAxis;
        newXAxis.x = projectedPosition.z;
        newXAxis.y = projectedPosition.x;
        newXAxis.z = projectedPosition.y;
        newXAxis.w = 0.0;

        Cartesian3.subtract(newXAxis, newOrigin, newXAxis);
        newXAxis.x = 0.0;

        var newYAxis = scratchCartesian4NewYAxis;
        if (Cartesian3.magnitudeSquared(newXAxis) > CesiumMath.EPSILON10) {
            Cartesian3.cross(newZAxis, newXAxis, newYAxis);
        } else {
            var yAxis = Cartesian4.add(Matrix4.getColumn(camera._transform, 1, scratchCartesian3), origin, scratchCartesian3);
            ellipsoid.cartesianToCartographic(yAxis, cartographic);

            projection.project(cartographic, projectedPosition);
            newYAxis.x = projectedPosition.z;
            newYAxis.y = projectedPosition.x;
            newYAxis.z = projectedPosition.y;
            newYAxis.w = 0.0;

            Cartesian3.subtract(newYAxis, newOrigin, newYAxis);
            newYAxis.x = 0.0;

            if (Cartesian3.magnitudeSquared(newYAxis) < CesiumMath.EPSILON10) {
                Cartesian4.clone(Cartesian4.UNIT_Y, newXAxis);
                Cartesian4.clone(Cartesian4.UNIT_Z, newYAxis);
            }
        }

        Cartesian3.cross(newYAxis, newZAxis, newXAxis);
        Cartesian3.normalize(newXAxis, newXAxis);
        Cartesian3.cross(newZAxis, newXAxis, newYAxis);
        Cartesian3.normalize(newYAxis, newYAxis);

        Matrix4.setColumn(camera._actualTransform, 0, newXAxis, camera._actualTransform);
        Matrix4.setColumn(camera._actualTransform, 1, newYAxis, camera._actualTransform);
        Matrix4.setColumn(camera._actualTransform, 2, newZAxis, camera._actualTransform);
        Matrix4.setColumn(camera._actualTransform, 3, newOrigin, camera._actualTransform);
    }

    var scratchCartesian = new Cartesian3();

    function updateMembers(camera) {
        var mode = camera._mode;

        var heightChanged = false;
        var height = 0.0;
        if (mode === SceneMode.SCENE2D) {
            height = camera.frustum.right - camera.frustum.left;
            heightChanged = height !== camera._positionCartographic.height;
        }

        var position = camera._position;
        var positionChanged = !Cartesian3.equals(position, camera.position) || heightChanged;
        if (positionChanged) {
            position = Cartesian3.clone(camera.position, camera._position);
        }

        var direction = camera._direction;
        var directionChanged = !Cartesian3.equals(direction, camera.direction);
        if (directionChanged) {
            Cartesian3.normalize(camera.direction, camera.direction);
            direction = Cartesian3.clone(camera.direction, camera._direction);
        }

        var up = camera._up;
        var upChanged = !Cartesian3.equals(up, camera.up);
        if (upChanged) {
            Cartesian3.normalize(camera.up, camera.up);
            up = Cartesian3.clone(camera.up, camera._up);
        }

        var right = camera._right;
        var rightChanged = !Cartesian3.equals(right, camera.right);
        if (rightChanged) {
            Cartesian3.normalize(camera.right, camera.right);
            right = Cartesian3.clone(camera.right, camera._right);
        }

        var transformChanged = camera._transformChanged || camera._modeChanged;
        camera._transformChanged = false;

        if (transformChanged) {
            Matrix4.inverseTransformation(camera._transform, camera._invTransform);

            if (camera._mode === SceneMode.COLUMBUS_VIEW || camera._mode === SceneMode.SCENE2D) {
                if (Matrix4.equals(Matrix4.IDENTITY, camera._transform)) {
                    Matrix4.clone(Camera.TRANSFORM_2D, camera._actualTransform);
                } else if (camera._mode === SceneMode.COLUMBUS_VIEW) {
                    convertTransformForColumbusView(camera);
                } else {
                    convertTransformFor2D(camera);
                }
            } else {
                Matrix4.clone(camera._transform, camera._actualTransform);
            }

            Matrix4.inverseTransformation(camera._actualTransform, camera._actualInvTransform);

            camera._modeChanged = false;
        }

        var transform = camera._actualTransform;

        if (positionChanged || transformChanged) {
            camera._positionWC = Matrix4.multiplyByPoint(transform, position, camera._positionWC);

            // Compute the Cartographic position of the camera.
            if (mode === SceneMode.SCENE3D || mode === SceneMode.MORPHING) {
                camera._positionCartographic = camera._projection.ellipsoid.cartesianToCartographic(camera._positionWC, camera._positionCartographic);
            } else {
                // The camera position is expressed in the 2D coordinate system where the Y axis is to the East,
                // the Z axis is to the North, and the X axis is out of the map.  Express them instead in the ENU axes where
                // X is to the East, Y is to the North, and Z is out of the local horizontal plane.
                var positionENU = scratchCartesian;
                positionENU.x = camera._positionWC.y;
                positionENU.y = camera._positionWC.z;
                positionENU.z = camera._positionWC.x;

                // In 2D, the camera height is always 12.7 million meters.
                // The apparent height is equal to half the frustum width.
                if (mode === SceneMode.SCENE2D) {
                    positionENU.z = height;
                }

                camera._projection.unproject(positionENU, camera._positionCartographic);
            }
        }

        if (directionChanged || upChanged || rightChanged) {
            var det = Cartesian3.dot(direction, Cartesian3.cross(up, right, scratchCartesian));
            if (Math.abs(1.0 - det) > CesiumMath.EPSILON2) {
                //orthonormalize axes
                var invUpMag = 1.0 / Cartesian3.magnitudeSquared(up);
                var scalar = Cartesian3.dot(up, direction) * invUpMag;
                var w0 = Cartesian3.multiplyByScalar(direction, scalar, scratchCartesian);
                up = Cartesian3.normalize(Cartesian3.subtract(up, w0, camera._up), camera._up);
                Cartesian3.clone(up, camera.up);

                right = Cartesian3.cross(direction, up, camera._right);
                Cartesian3.clone(right, camera.right);
            }
        }

        if (directionChanged || transformChanged) {
            camera._directionWC = Matrix4.multiplyByPointAsVector(transform, direction, camera._directionWC);
            Cartesian3.normalize(camera._directionWC, camera._directionWC);
        }

        if (upChanged || transformChanged) {
            camera._upWC = Matrix4.multiplyByPointAsVector(transform, up, camera._upWC);
            Cartesian3.normalize(camera._upWC, camera._upWC);
        }

        if (rightChanged || transformChanged) {
            camera._rightWC = Matrix4.multiplyByPointAsVector(transform, right, camera._rightWC);
            Cartesian3.normalize(camera._rightWC, camera._rightWC);
        }

        if (positionChanged || directionChanged || upChanged || rightChanged || transformChanged) {
            updateViewMatrix(camera);
        }
    }

    function getHeading(direction, up) {
        var heading;
        if (!CesiumMath.equalsEpsilon(Math.abs(direction.z), 1.0, CesiumMath.EPSILON3)) {
            heading = Math.atan2(direction.y, direction.x) - CesiumMath.PI_OVER_TWO;
        } else {
            heading = Math.atan2(up.y, up.x) - CesiumMath.PI_OVER_TWO;
        }

        return CesiumMath.TWO_PI - CesiumMath.zeroToTwoPi(heading);
    }

    function getPitch(direction) {
        return CesiumMath.PI_OVER_TWO - CesiumMath.acosClamped(direction.z);
    }

    function getRoll(direction, up, right) {
        var roll = 0.0;
        if (!CesiumMath.equalsEpsilon(Math.abs(direction.z), 1.0, CesiumMath.EPSILON3)) {
            roll = Math.atan2(-right.z, up.z);
            roll = CesiumMath.zeroToTwoPi(roll + CesiumMath.TWO_PI);
        }

        return roll;
    }

    var scratchHPRMatrix1 = new Matrix4();
    var scratchHPRMatrix2 = new Matrix4();

    defineProperties(Camera.prototype, {
        /**
         * Gets the camera's reference frame. The inverse of this transformation is appended to the view matrix.
         * @memberof Camera.prototype
         *
         * @type {Matrix4}
         * @readonly
         *
         * @default {@link Matrix4.IDENTITY}
         */
        transform : {
            get : function() {
                return this._transform;
            }
        },

        /**
         * Gets the inverse camera transform.
         * @memberof Camera.prototype
         *
         * @type {Matrix4}
         * @readonly
         *
         * @default {@link Matrix4.IDENTITY}
         */
        inverseTransform : {
            get : function() {
                updateMembers(this);
                return this._invTransform;
            }
        },

        /**
         * Gets the view matrix.
         * @memberof Camera.prototype
         *
         * @type {Matrix4}
         * @readonly
         *
         * @see Camera#inverseViewMatrix
         */
        viewMatrix : {
            get : function() {
                updateMembers(this);
                return this._viewMatrix;
            }
        },

        /**
         * Gets the inverse view matrix.
         * @memberof Camera.prototype
         *
         * @type {Matrix4}
         * @readonly
         *
         * @see Camera#viewMatrix
         */
        inverseViewMatrix : {
            get : function() {
                updateMembers(this);
                return this._invViewMatrix;
            }
        },

        /**
         * Gets the {@link Cartographic} position of the camera, with longitude and latitude
         * expressed in radians and height in meters.  In 2D and Columbus View, it is possible
         * for the returned longitude and latitude to be outside the range of valid longitudes
         * and latitudes when the camera is outside the map.
         * @memberof Camera.prototype
         *
         * @type {Cartographic}
         * @readonly
         */
        positionCartographic : {
            get : function() {
                updateMembers(this);
                return this._positionCartographic;
            }
        },

        /**
         * Gets the position of the camera in world coordinates.
         * @memberof Camera.prototype
         *
         * @type {Cartesian3}
         * @readonly
         */
        positionWC : {
            get : function() {
                updateMembers(this);
                return this._positionWC;
            }
        },

        /**
         * Gets the view direction of the camera in world coordinates.
         * @memberof Camera.prototype
         *
         * @type {Cartesian3}
         * @readonly
         */
        directionWC : {
            get : function() {
                updateMembers(this);
                return this._directionWC;
            }
        },

        /**
         * Gets the up direction of the camera in world coordinates.
         * @memberof Camera.prototype
         *
         * @type {Cartesian3}
         * @readonly
         */
        upWC : {
            get : function() {
                updateMembers(this);
                return this._upWC;
            }
        },

        /**
         * Gets the right direction of the camera in world coordinates.
         * @memberof Camera.prototype
         *
         * @type {Cartesian3}
         * @readonly
         */
        rightWC : {
            get : function() {
                updateMembers(this);
                return this._rightWC;
            }
        },

        /**
         * Gets the camera heading in radians.
         * @memberof Camera.prototype
         *
         * @type {Number}
         * @readonly
         */
        heading : {
            get : function() {
                if (this._mode !== SceneMode.MORPHING) {
                    var ellipsoid = this._projection.ellipsoid;

                    var oldTransform = Matrix4.clone(this._transform, scratchHPRMatrix1);
                    var transform = Transforms.eastNorthUpToFixedFrame(this.positionWC, ellipsoid, scratchHPRMatrix2);
                    this._setTransform(transform);

                    var heading = getHeading(this.direction, this.up);

                    this._setTransform(oldTransform);

                    return heading;
                }

                return undefined;
            }
        },

        /**
         * Gets the camera pitch in radians.
         * @memberof Camera.prototype
         *
         * @type {Number}
         * @readonly
         */
        pitch : {
            get : function() {
                if (this._mode !== SceneMode.MORPHING) {
                    var ellipsoid = this._projection.ellipsoid;

                    var oldTransform = Matrix4.clone(this._transform, scratchHPRMatrix1);
                    var transform = Transforms.eastNorthUpToFixedFrame(this.positionWC, ellipsoid, scratchHPRMatrix2);
                    this._setTransform(transform);

                    var pitch = getPitch(this.direction);

                    this._setTransform(oldTransform);

                    return pitch;
                }

                return undefined;
            }
        },

        /**
         * Gets the camera roll in radians.
         * @memberof Camera.prototype
         *
         * @type {Number}
         * @readonly
         */
        roll : {
            get : function() {
                if (this._mode !== SceneMode.MORPHING) {
                    var ellipsoid = this._projection.ellipsoid;

                    var oldTransform = Matrix4.clone(this._transform, scratchHPRMatrix1);
                    var transform = Transforms.eastNorthUpToFixedFrame(this.positionWC, ellipsoid, scratchHPRMatrix2);
                    this._setTransform(transform);

                    var roll = getRoll(this.direction, this.up, this.right);

                    this._setTransform(oldTransform);

                    return roll;
                }

                return undefined;
            }
        },

        /**
         * Gets the event that will be raised at when the camera starts to move.
         * @memberof Camera.prototype
         * @type {Event}
         * @readonly
         */
        moveStart : {
            get : function() {
                return this._moveStart;
            }
        },

        /**
         * Gets the event that will be raised when the camera has stopped moving.
         * @memberof Camera.prototype
         * @type {Event}
         * @readonly
         */
        moveEnd : {
            get : function() {
                return this._moveEnd;
            }
        },

        /**
         * Gets the event that will be raised when the camera has changed by <code>percentageChanged</code>.
         * @memberof Camera.prototype
         * @type {Event}
         * @readonly
         */
        changed : {
            get : function() {
                return this._changed;
            }
        }
    });

    /**
     * @private
     */
    Camera.prototype.update = function(mode) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(mode)) {
            throw new DeveloperError('mode is required.');
        }
        if (mode === SceneMode.SCENE2D && !(this.frustum instanceof OrthographicOffCenterFrustum)) {
            throw new DeveloperError('An OrthographicOffCenterFrustum is required in 2D.');
        }
        if ((mode === SceneMode.SCENE3D || mode === SceneMode.COLUMBUS_VIEW) &&
            (!(this.frustum instanceof PerspectiveFrustum) && !(this.frustum instanceof OrthographicFrustum))) {
            throw new DeveloperError('A PerspectiveFrustum or OrthographicFrustum is required in 3D and Columbus view');
        }
        //>>includeEnd('debug');

        var updateFrustum = false;
        if (mode !== this._mode) {
            this._mode = mode;
            this._modeChanged = mode !== SceneMode.MORPHING;
            updateFrustum = this._mode === SceneMode.SCENE2D;
        }

        if (updateFrustum) {
            var frustum = this._max2Dfrustum = this.frustum.clone();

            //>>includeStart('debug', pragmas.debug);
            if (!(frustum instanceof OrthographicOffCenterFrustum)) {
                throw new DeveloperError('The camera frustum is expected to be orthographic for 2D camera control.');
            }
            //>>includeEnd('debug');

            var maxZoomOut = 2.0;
            var ratio = frustum.top / frustum.right;
            frustum.right = this._maxCoord.x * maxZoomOut;
            frustum.left = -frustum.right;
            frustum.top = ratio * frustum.right;
            frustum.bottom = -frustum.top;
        }

        if (this._mode === SceneMode.SCENE2D) {
            clampMove2D(this, this.position);
        }

        var globe = this._scene.globe;
        var globeFinishedUpdating = !defined(globe) || (globe._surface.tileProvider.ready && globe._surface._tileLoadQueueHigh.length === 0 && globe._surface._tileLoadQueueMedium.length === 0 && globe._surface._tileLoadQueueLow.length === 0 && globe._surface._debug.tilesWaitingForChildren === 0);
        if (this._suspendTerrainAdjustment) {
            this._suspendTerrainAdjustment = !globeFinishedUpdating;
        }
        this._adjustHeightForTerrain();
    };

    var setTransformPosition = new Cartesian3();
    var setTransformUp = new Cartesian3();
    var setTransformDirection = new Cartesian3();

    Camera.prototype._setTransform = function(transform) {
        var position = Cartesian3.clone(this.positionWC, setTransformPosition);
        var up = Cartesian3.clone(this.upWC, setTransformUp);
        var direction = Cartesian3.clone(this.directionWC, setTransformDirection);

        Matrix4.clone(transform, this._transform);
        this._transformChanged = true;
        updateMembers(this);
        var inverse = this._actualInvTransform;

        Matrix4.multiplyByPoint(inverse, position, this.position);
        Matrix4.multiplyByPointAsVector(inverse, direction, this.direction);
        Matrix4.multiplyByPointAsVector(inverse, up, this.up);
        Cartesian3.cross(this.direction, this.up, this.right);

        updateMembers(this);
    };

    var scratchAdjustOrtghographicFrustumMousePosition = new Cartesian2();
    var pickGlobeScratchRay = new Ray();
    var scratchRayIntersection = new Cartesian3();
    var scratchDepthIntersection = new Cartesian3();

    Camera.prototype._adjustOrthographicFrustum = function(zooming) {
        if (!(this.frustum instanceof OrthographicFrustum)) {
            return;
        }

        if (!zooming && this._positionCartographic.height < 150000.0) {
            return;
        }

        if (!Matrix4.equals(Matrix4.IDENTITY, this.transform)) {
            this.frustum.width = Cartesian3.magnitude(this.position);
            return;
        }

        var scene = this._scene;
        var globe = scene._globe;
        var rayIntersection;
        var depthIntersection;

        if (defined(globe)) {
            var mousePosition = scratchAdjustOrtghographicFrustumMousePosition;
            mousePosition.x = scene.drawingBufferWidth / 2.0;
            mousePosition.y = scene.drawingBufferHeight / 2.0;

            var ray = this.getPickRay(mousePosition, pickGlobeScratchRay);
            rayIntersection = globe.pick(ray, scene, scratchRayIntersection);

            if (scene.pickPositionSupported) {
                depthIntersection = scene.pickPositionWorldCoordinates(mousePosition, scratchDepthIntersection);
            }

            if (defined(rayIntersection) && defined(depthIntersection)) {
                var depthDistance = defined(depthIntersection) ? Cartesian3.distance(depthIntersection, this.positionWC) : Number.POSITIVE_INFINITY;
                var rayDistance = defined(rayIntersection) ? Cartesian3.distance(rayIntersection, this.positionWC) : Number.POSITIVE_INFINITY;
                this.frustum.width = Math.min(depthDistance, rayDistance);
            } else if (defined(depthIntersection)) {
                this.frustum.width = Cartesian3.distance(depthIntersection, this.positionWC);
            } else if (defined(rayIntersection)) {
                this.frustum.width = Cartesian3.distance(rayIntersection, this.positionWC);
            }
        }

        if (!defined(globe) || (!defined(rayIntersection) && !defined(depthIntersection))) {
            var distance = Math.max(this.positionCartographic.height, 0.0);
            this.frustum.width = distance;
        }
    };

    var scratchSetViewCartesian = new Cartesian3();
    var scratchSetViewTransform1 = new Matrix4();
    var scratchSetViewTransform2 = new Matrix4();
    var scratchSetViewQuaternion = new Quaternion();
    var scratchSetViewMatrix3 = new Matrix3();
    var scratchSetViewCartographic = new Cartographic();

    function setView3D(camera, position, hpr) {
        var currentTransform = Matrix4.clone(camera.transform, scratchSetViewTransform1);
        var localTransform = Transforms.eastNorthUpToFixedFrame(position, camera._projection.ellipsoid, scratchSetViewTransform2);
        camera._setTransform(localTransform);

        Cartesian3.clone(Cartesian3.ZERO, camera.position);
        hpr.heading = hpr.heading - CesiumMath.PI_OVER_TWO;

        var rotQuat = Quaternion.fromHeadingPitchRoll(hpr, scratchSetViewQuaternion);
        var rotMat = Matrix3.fromQuaternion(rotQuat, scratchSetViewMatrix3);

        Matrix3.getColumn(rotMat, 0, camera.direction);
        Matrix3.getColumn(rotMat, 2, camera.up);
        Cartesian3.cross(camera.direction, camera.up, camera.right);

        camera._setTransform(currentTransform);

        camera._adjustOrthographicFrustum(true);
    }

    function setViewCV(camera, position,hpr, convert) {
        var currentTransform = Matrix4.clone(camera.transform, scratchSetViewTransform1);
        camera._setTransform(Matrix4.IDENTITY);

        if (!Cartesian3.equals(position, camera.positionWC)) {
            if (convert) {
                var projection = camera._projection;
                var cartographic = projection.ellipsoid.cartesianToCartographic(position, scratchSetViewCartographic);
                position = projection.project(cartographic, scratchSetViewCartesian);
            }
            Cartesian3.clone(position, camera.position);
        }
        hpr.heading = hpr.heading - CesiumMath.PI_OVER_TWO;

        var rotQuat = Quaternion.fromHeadingPitchRoll(hpr, scratchSetViewQuaternion);
        var rotMat = Matrix3.fromQuaternion(rotQuat, scratchSetViewMatrix3);

        Matrix3.getColumn(rotMat, 0, camera.direction);
        Matrix3.getColumn(rotMat, 2, camera.up);
        Cartesian3.cross(camera.direction, camera.up, camera.right);

        camera._setTransform(currentTransform);

        camera._adjustOrthographicFrustum(true);
    }

    function setView2D(camera, position, hpr, convert) {
        var currentTransform = Matrix4.clone(camera.transform, scratchSetViewTransform1);
        camera._setTransform(Matrix4.IDENTITY);

        if (!Cartesian3.equals(position, camera.positionWC)) {
            if (convert) {
                var projection = camera._projection;
                var cartographic = projection.ellipsoid.cartesianToCartographic(position, scratchSetViewCartographic);
                position = projection.project(cartographic, scratchSetViewCartesian);
            }

            Cartesian2.clone(position, camera.position);

            var newLeft = -position.z * 0.5;
            var newRight = -newLeft;

            var frustum = camera.frustum;
            if (newRight > newLeft) {
                var ratio = frustum.top / frustum.right;
                frustum.right = newRight;
                frustum.left = newLeft;
                frustum.top = frustum.right * ratio;
                frustum.bottom = -frustum.top;
            }
        }

        if (camera._scene.mapMode2D === MapMode2D.ROTATE) {
            hpr.heading = hpr.heading  - CesiumMath.PI_OVER_TWO;
            hpr.pitch = -CesiumMath.PI_OVER_TWO;
            hpr.roll =  0.0;
            var rotQuat = Quaternion.fromHeadingPitchRoll(hpr, scratchSetViewQuaternion);
            var rotMat = Matrix3.fromQuaternion(rotQuat, scratchSetViewMatrix3);

            Matrix3.getColumn(rotMat, 2, camera.up);
            Cartesian3.cross(camera.direction, camera.up, camera.right);
        }

        camera._setTransform(currentTransform);
    }

    var scratchToHPRDirection = new Cartesian3();
    var scratchToHPRUp = new Cartesian3();
    var scratchToHPRRight = new Cartesian3();

    function directionUpToHeadingPitchRoll(camera, position, orientation, result) {
        var direction = Cartesian3.clone(orientation.direction, scratchToHPRDirection);
        var up = Cartesian3.clone(orientation.up, scratchToHPRUp);

        if (camera._scene.mode === SceneMode.SCENE3D) {
            var ellipsoid = camera._projection.ellipsoid;
            var transform = Transforms.eastNorthUpToFixedFrame(position, ellipsoid, scratchHPRMatrix1);
            var invTransform = Matrix4.inverseTransformation(transform, scratchHPRMatrix2);

            Matrix4.multiplyByPointAsVector(invTransform, direction, direction);
            Matrix4.multiplyByPointAsVector(invTransform, up, up);
        }

        var right = Cartesian3.cross(direction, up, scratchToHPRRight);

        result.heading = getHeading(direction, up);
        result.pitch = getPitch(direction);
        result.roll = getRoll(direction, up, right);

        return result;
    }

    var scratchSetViewOptions = {
        destination : undefined,
        orientation : {
            direction : undefined,
            up : undefined,
            heading : undefined,
            pitch : undefined,
            roll : undefined
        },
        convert : undefined,
        endTransform : undefined
    };

    var scratchHpr = new HeadingPitchRoll();
    /**
     * Sets the camera position, orientation and transform.
     *
     * @param {Object} options Object with the following properties:
     * @param {Cartesian3|Rectangle} [options.destination] The final position of the camera in WGS84 (world) coordinates or a rectangle that would be visible from a top-down view.
     * @param {Object} [options.orientation] An object that contains either direction and up properties or heading, pitch and roll properties. By default, the direction will point
     * towards the center of the frame in 3D and in the negative z direction in Columbus view. The up direction will point towards local north in 3D and in the positive
     * y direction in Columbus view. Orientation is not used in 2D when in infinite scrolling mode.
     * @param {Matrix4} [options.endTransform] Transform matrix representing the reference frame of the camera.
     *
     * @example
     * // 1. Set position with a top-down view
     * viewer.camera.setView({
     *     destination : Cesium.Cartesian3.fromDegrees(-117.16, 32.71, 15000.0)
     * });
     *
     * // 2 Set view with heading, pitch and roll
     * viewer.camera.setView({
     *     destination : cartesianPosition,
     *     orientation: {
     *         heading : Cesium.Math.toRadians(90.0), // east, default value is 0.0 (north)
     *         pitch : Cesium.Math.toRadians(-90),    // default value (looking down)
     *         roll : 0.0                             // default value
     *     }
     * });
     *
     * // 3. Change heading, pitch and roll with the camera position remaining the same.
     * viewer.camera.setView({
     *     orientation: {
     *         heading : Cesium.Math.toRadians(90.0), // east, default value is 0.0 (north)
     *         pitch : Cesium.Math.toRadians(-90),    // default value (looking down)
     *         roll : 0.0                             // default value
     *     }
     * });
     *
     *
     * // 4. View rectangle with a top-down view
     * viewer.camera.setView({
     *     destination : Cesium.Rectangle.fromDegrees(west, south, east, north)
     * });
     *
     * // 5. Set position with an orientation using unit vectors.
     * viewer.camera.setView({
     *     destination : Cesium.Cartesian3.fromDegrees(-122.19, 46.25, 5000.0),
     *     orientation : {
     *         direction : new Cesium.Cartesian3(-0.04231243104240401, -0.20123236049443421, -0.97862924300734),
     *         up : new Cesium.Cartesian3(-0.47934589305293746, -0.8553216253114552, 0.1966022179118339)
     *     }
     * });
     */
    Camera.prototype.setView = function(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        var orientation = defaultValue(options.orientation, defaultValue.EMPTY_OBJECT);

        var mode = this._mode;
        if (mode === SceneMode.MORPHING) {
            return;
        }

        if (defined(options.endTransform)) {
            this._setTransform(options.endTransform);
        }

        var convert = defaultValue(options.convert, true);
        var destination = defaultValue(options.destination, Cartesian3.clone(this.positionWC, scratchSetViewCartesian));
        if (defined(destination) && defined(destination.west)) {
            destination = this.getRectangleCameraCoordinates(destination, scratchSetViewCartesian);
            convert = false;
        }

        if (defined(orientation.direction)) {
            orientation = directionUpToHeadingPitchRoll(this, destination, orientation, scratchSetViewOptions.orientation);
        }

        scratchHpr.heading = defaultValue(orientation.heading, 0.0);
        scratchHpr.pitch = defaultValue(orientation.pitch, -CesiumMath.PI_OVER_TWO);
        scratchHpr.roll = defaultValue(orientation.roll, 0.0);

        //zhangli2018 true->false
		this._suspendTerrainAdjustment = false;

        if (mode === SceneMode.SCENE3D) {
            setView3D(this, destination, scratchHpr);
        } else if (mode === SceneMode.SCENE2D) {
            setView2D(this, destination, scratchHpr, convert);
        } else {
            setViewCV(this, destination, scratchHpr, convert);
        }
    };

    var pitchScratch = new Cartesian3();
    /**
     * Fly the camera to the home view.  Use {@link Camera#.DEFAULT_VIEW_RECTANGLE} to set
     * the default view for the 3D scene.  The home view for 2D and columbus view shows the
     * entire map.
     *
     * @param {Number} [duration] The duration of the flight in seconds. If omitted, Cesium attempts to calculate an ideal duration based on the distance to be traveled by the flight. See {@link Camera#flyTo}
     */
    Camera.prototype.flyHome = function(duration) {
        var mode = this._mode;

        if (mode === SceneMode.MORPHING) {
            this._scene.completeMorph();
        }

        if (mode === SceneMode.SCENE2D) {
            this.flyTo({
                destination : Camera.DEFAULT_VIEW_RECTANGLE,
                duration : duration,
                endTransform : Matrix4.IDENTITY
            });
        } else if (mode === SceneMode.SCENE3D) {
            var destination = this.getRectangleCameraCoordinates(Camera.DEFAULT_VIEW_RECTANGLE);

            var mag = Cartesian3.magnitude(destination);
            mag += mag * Camera.DEFAULT_VIEW_FACTOR;
            Cartesian3.normalize(destination, destination);
            Cartesian3.multiplyByScalar(destination, mag, destination);

            this.flyTo({
                destination : destination,
                duration : duration,
                endTransform : Matrix4.IDENTITY
            });
        } else if (mode === SceneMode.COLUMBUS_VIEW) {
            var maxRadii = this._projection.ellipsoid.maximumRadius;
            var position = new Cartesian3(0.0, -1.0, 1.0);
            position = Cartesian3.multiplyByScalar(Cartesian3.normalize(position, position), 5.0 * maxRadii, position);
            this.flyTo({
                destination : position,
                duration : duration,
                orientation : {
                    heading : 0.0,
                    pitch : -Math.acos(Cartesian3.normalize(position, pitchScratch).z),
                    roll : 0.0
                },
                endTransform : Matrix4.IDENTITY,
                convert : false
            });
        }
    };

    /**
     * Transform a vector or point from world coordinates to the camera's reference frame.
     *
     * @param {Cartesian4} cartesian The vector or point to transform.
     * @param {Cartesian4} [result] The object onto which to store the result.
     * @returns {Cartesian4} The transformed vector or point.
     */
    Camera.prototype.worldToCameraCoordinates = function(cartesian, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(cartesian)) {
            throw new DeveloperError('cartesian is required.');
        }
        //>>includeEnd('debug');

        if (!defined(result)) {
            result = new Cartesian4();
        }
        updateMembers(this);
        return Matrix4.multiplyByVector(this._actualInvTransform, cartesian, result);
    };

    /**
     * Transform a point from world coordinates to the camera's reference frame.
     *
     * @param {Cartesian3} cartesian The point to transform.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The transformed point.
     */
    Camera.prototype.worldToCameraCoordinatesPoint = function(cartesian, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(cartesian)) {
            throw new DeveloperError('cartesian is required.');
        }
        //>>includeEnd('debug');

        if (!defined(result)) {
            result = new Cartesian3();
        }
        updateMembers(this);
        return Matrix4.multiplyByPoint(this._actualInvTransform, cartesian, result);
    };

    /**
     * Transform a vector from world coordinates to the camera's reference frame.
     *
     * @param {Cartesian3} cartesian The vector to transform.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The transformed vector.
     */
    Camera.prototype.worldToCameraCoordinatesVector = function(cartesian, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(cartesian)) {
            throw new DeveloperError('cartesian is required.');
        }
        //>>includeEnd('debug');

        if (!defined(result)) {
            result = new Cartesian3();
        }
        updateMembers(this);
        return Matrix4.multiplyByPointAsVector(this._actualInvTransform, cartesian, result);
    };

    /**
     * Transform a vector or point from the camera's reference frame to world coordinates.
     *
     * @param {Cartesian4} cartesian The vector or point to transform.
     * @param {Cartesian4} [result] The object onto which to store the result.
     * @returns {Cartesian4} The transformed vector or point.
     */
    Camera.prototype.cameraToWorldCoordinates = function(cartesian, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(cartesian)) {
            throw new DeveloperError('cartesian is required.');
        }
        //>>includeEnd('debug');

        if (!defined(result)) {
            result = new Cartesian4();
        }
        updateMembers(this);
        return Matrix4.multiplyByVector(this._actualTransform, cartesian, result);
    };

    /**
     * Transform a point from the camera's reference frame to world coordinates.
     *
     * @param {Cartesian3} cartesian The point to transform.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The transformed point.
     */
    Camera.prototype.cameraToWorldCoordinatesPoint = function(cartesian, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(cartesian)) {
            throw new DeveloperError('cartesian is required.');
        }
        //>>includeEnd('debug');

        if (!defined(result)) {
            result = new Cartesian3();
        }
        updateMembers(this);
        return Matrix4.multiplyByPoint(this._actualTransform, cartesian, result);
    };

    /**
     * Transform a vector from the camera's reference frame to world coordinates.
     *
     * @param {Cartesian3} cartesian The vector to transform.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} The transformed vector.
     */
    Camera.prototype.cameraToWorldCoordinatesVector = function(cartesian, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(cartesian)) {
            throw new DeveloperError('cartesian is required.');
        }
        //>>includeEnd('debug');

        if (!defined(result)) {
            result = new Cartesian3();
        }
        updateMembers(this);
        return Matrix4.multiplyByPointAsVector(this._actualTransform, cartesian, result);
    };

    function clampMove2D(camera, position) {
        var rotatable2D = camera._scene.mapMode2D === MapMode2D.ROTATE;
        var maxProjectedX = camera._maxCoord.x;
        var maxProjectedY = camera._maxCoord.y;

        var minX;
        var maxX;
        if (rotatable2D) {
            maxX = maxProjectedX;
            minX = -maxX;
        } else {
            maxX = position.x - maxProjectedX * 2.0;
            minX = position.x + maxProjectedX * 2.0;
        }

        if (position.x > maxProjectedX) {
            position.x = maxX;
        }
        if (position.x < -maxProjectedX) {
            position.x = minX;
        }

        if (position.y > maxProjectedY) {
            position.y = maxProjectedY;
        }
        if (position.y < -maxProjectedY) {
            position.y = -maxProjectedY;
        }
    }

    var moveScratch = new Cartesian3();
    /**
     * Translates the camera's position by <code>amount</code> along <code>direction</code>.
     *
     * @param {Cartesian3} direction The direction to move.
     * @param {Number} [amount] The amount, in meters, to move. Defaults to <code>defaultMoveAmount</code>.
     *
     * @see Camera#moveBackward
     * @see Camera#moveForward
     * @see Camera#moveLeft
     * @see Camera#moveRight
     * @see Camera#moveUp
     * @see Camera#moveDown
     */
    Camera.prototype.move = function(direction, amount) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(direction)) {
            throw new DeveloperError('direction is required.');
        }
        //>>includeEnd('debug');

        var cameraPosition = this.position;
        Cartesian3.multiplyByScalar(direction, amount, moveScratch);
        Cartesian3.add(cameraPosition, moveScratch, cameraPosition);

        if (this._mode === SceneMode.SCENE2D) {
            clampMove2D(this, cameraPosition);
        }
        this._adjustOrthographicFrustum(true);
    };

    /**
     * Translates the camera's position by <code>amount</code> along the camera's view vector.
     *
     * @param {Number} [amount] The amount, in meters, to move. Defaults to <code>defaultMoveAmount</code>.
     *
     * @see Camera#moveBackward
     */
    Camera.prototype.moveForward = function(amount) {
        amount = defaultValue(amount, this.defaultMoveAmount);
        this.move(this.direction, amount);
    };

    /**
     * Translates the camera's position by <code>amount</code> along the opposite direction
     * of the camera's view vector.
     *
     * @param {Number} [amount] The amount, in meters, to move. Defaults to <code>defaultMoveAmount</code>.
     *
     * @see Camera#moveForward
     */
    Camera.prototype.moveBackward = function(amount) {
        amount = defaultValue(amount, this.defaultMoveAmount);
        this.move(this.direction, -amount);
    };

    /**
     * Translates the camera's position by <code>amount</code> along the camera's up vector.
     *
     * @param {Number} [amount] The amount, in meters, to move. Defaults to <code>defaultMoveAmount</code>.
     *
     * @see Camera#moveDown
     */
    Camera.prototype.moveUp = function(amount) {
        amount = defaultValue(amount, this.defaultMoveAmount);
        this.move(this.up, amount);
    };

    /**
     * Translates the camera's position by <code>amount</code> along the opposite direction
     * of the camera's up vector.
     *
     * @param {Number} [amount] The amount, in meters, to move. Defaults to <code>defaultMoveAmount</code>.
     *
     * @see Camera#moveUp
     */
    Camera.prototype.moveDown = function(amount) {
        amount = defaultValue(amount, this.defaultMoveAmount);
        this.move(this.up, -amount);
    };

    /**
     * Translates the camera's position by <code>amount</code> along the camera's right vector.
     *
     * @param {Number} [amount] The amount, in meters, to move. Defaults to <code>defaultMoveAmount</code>.
     *
     * @see Camera#moveLeft
     */
    Camera.prototype.moveRight = function(amount) {
        amount = defaultValue(amount, this.defaultMoveAmount);
        this.move(this.right, amount);
    };

    /**
     * Translates the camera's position by <code>amount</code> along the opposite direction
     * of the camera's right vector.
     *
     * @param {Number} [amount] The amount, in meters, to move. Defaults to <code>defaultMoveAmount</code>.
     *
     * @see Camera#moveRight
     */
    Camera.prototype.moveLeft = function(amount) {
        amount = defaultValue(amount, this.defaultMoveAmount);
        this.move(this.right, -amount);
    };

    /**
     * Rotates the camera around its up vector by amount, in radians, in the opposite direction
     * of its right vector.
     *
     * @param {Number} [amount] The amount, in radians, to rotate by. Defaults to <code>defaultLookAmount</code>.
     *
     * @see Camera#lookRight
     */
    Camera.prototype.lookLeft = function(amount) {
        amount = defaultValue(amount, this.defaultLookAmount);
        this.look(this.up, -amount);
    };

    /**
     * Rotates the camera around its up vector by amount, in radians, in the direction
     * of its right vector.
     *
     * @param {Number} [amount] The amount, in radians, to rotate by. Defaults to <code>defaultLookAmount</code>.
     *
     * @see Camera#lookLeft
     */
    Camera.prototype.lookRight = function(amount) {
        amount = defaultValue(amount, this.defaultLookAmount);
        this.look(this.up, amount);
    };

    /**
     * Rotates the camera around its right vector by amount, in radians, in the direction
     * of its up vector.
     *
     * @param {Number} [amount] The amount, in radians, to rotate by. Defaults to <code>defaultLookAmount</code>.
     *
     * @see Camera#lookDown
     */
    Camera.prototype.lookUp = function(amount) {
        amount = defaultValue(amount, this.defaultLookAmount);
        this.look(this.right, -amount);
    };

    /**
     * Rotates the camera around its right vector by amount, in radians, in the opposite direction
     * of its up vector.
     *
     * @param {Number} [amount] The amount, in radians, to rotate by. Defaults to <code>defaultLookAmount</code>.
     *
     * @see Camera#lookUp
     */
    Camera.prototype.lookDown = function(amount) {
        amount = defaultValue(amount, this.defaultLookAmount);
        this.look(this.right, amount);
    };

    var lookScratchQuaternion = new Quaternion();
    var lookScratchMatrix = new Matrix3();
    /**
     * Rotate each of the camera's orientation vectors around <code>axis</code> by <code>angle</code>
     *
     * @param {Cartesian3} axis The axis to rotate around.
     * @param {Number} [angle] The angle, in radians, to rotate by. Defaults to <code>defaultLookAmount</code>.
     *
     * @see Camera#lookUp
     * @see Camera#lookDown
     * @see Camera#lookLeft
     * @see Camera#lookRight
     */
    Camera.prototype.look = function(axis, angle) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(axis)) {
            throw new DeveloperError('axis is required.');
        }
        //>>includeEnd('debug');

        var turnAngle = defaultValue(angle, this.defaultLookAmount);
        var quaternion = Quaternion.fromAxisAngle(axis, -turnAngle, lookScratchQuaternion);
        var rotation = Matrix3.fromQuaternion(quaternion, lookScratchMatrix);

        var direction = this.direction;
        var up = this.up;
        var right = this.right;

        Matrix3.multiplyByVector(rotation, direction, direction);
        Matrix3.multiplyByVector(rotation, up, up);
        Matrix3.multiplyByVector(rotation, right, right);
    };

    /**
     * Rotate the camera counter-clockwise around its direction vector by amount, in radians.
     *
     * @param {Number} [amount] The amount, in radians, to rotate by. Defaults to <code>defaultLookAmount</code>.
     *
     * @see Camera#twistRight
     */
    Camera.prototype.twistLeft = function(amount) {
        amount = defaultValue(amount, this.defaultLookAmount);
        this.look(this.direction, amount);
    };

    /**
     * Rotate the camera clockwise around its direction vector by amount, in radians.
     *
     * @param {Number} [amount] The amount, in radians, to rotate by. Defaults to <code>defaultLookAmount</code>.
     *
     * @see Camera#twistLeft
     */
    Camera.prototype.twistRight = function(amount) {
        amount = defaultValue(amount, this.defaultLookAmount);
        this.look(this.direction, -amount);
    };

    var rotateScratchQuaternion = new Quaternion();
    var rotateScratchMatrix = new Matrix3();
    /**
     * Rotates the camera around <code>axis</code> by <code>angle</code>. The distance
     * of the camera's position to the center of the camera's reference frame remains the same.
     *
     * @param {Cartesian3} axis The axis to rotate around given in world coordinates.
     * @param {Number} [angle] The angle, in radians, to rotate by. Defaults to <code>defaultRotateAmount</code>.
     *
     * @see Camera#rotateUp
     * @see Camera#rotateDown
     * @see Camera#rotateLeft
     * @see Camera#rotateRight
     */
    Camera.prototype.rotate = function(axis, angle) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(axis)) {
            throw new DeveloperError('axis is required.');
        }
        //>>includeEnd('debug');

        var turnAngle = defaultValue(angle, this.defaultRotateAmount);
        var quaternion = Quaternion.fromAxisAngle(axis, -turnAngle, rotateScratchQuaternion);
        var rotation = Matrix3.fromQuaternion(quaternion, rotateScratchMatrix);
        Matrix3.multiplyByVector(rotation, this.position, this.position);
        Matrix3.multiplyByVector(rotation, this.direction, this.direction);
        Matrix3.multiplyByVector(rotation, this.up, this.up);
        Cartesian3.cross(this.direction, this.up, this.right);
        Cartesian3.cross(this.right, this.direction, this.up);

        this._adjustOrthographicFrustum(false);
    };

    /**
     * Rotates the camera around the center of the camera's reference frame by angle downwards.
     *
     * @param {Number} [angle] The angle, in radians, to rotate by. Defaults to <code>defaultRotateAmount</code>.
     *
     * @see Camera#rotateUp
     * @see Camera#rotate
     */
    Camera.prototype.rotateDown = function(angle) {
        angle = defaultValue(angle, this.defaultRotateAmount);
        rotateVertical(this, angle);
    };

    /**
     * Rotates the camera around the center of the camera's reference frame by angle upwards.
     *
     * @param {Number} [angle] The angle, in radians, to rotate by. Defaults to <code>defaultRotateAmount</code>.
     *
     * @see Camera#rotateDown
     * @see Camera#rotate
     */
    Camera.prototype.rotateUp = function(angle) {
        angle = defaultValue(angle, this.defaultRotateAmount);
        rotateVertical(this, -angle);
    };

    var rotateVertScratchP = new Cartesian3();
    var rotateVertScratchA = new Cartesian3();
    var rotateVertScratchTan = new Cartesian3();
    var rotateVertScratchNegate = new Cartesian3();
    function rotateVertical(camera, angle) {
        var position = camera.position;
        var p = Cartesian3.normalize(position, rotateVertScratchP);
        if (defined(camera.constrainedAxis)) {
            var northParallel = Cartesian3.equalsEpsilon(p, camera.constrainedAxis, CesiumMath.EPSILON2);
            var southParallel = Cartesian3.equalsEpsilon(p, Cartesian3.negate(camera.constrainedAxis, rotateVertScratchNegate), CesiumMath.EPSILON2);
            if ((!northParallel && !southParallel)) {
                var constrainedAxis = Cartesian3.normalize(camera.constrainedAxis, rotateVertScratchA);

                var dot = Cartesian3.dot(p, constrainedAxis);
                var angleToAxis = CesiumMath.acosClamped(dot);
                if (angle > 0 && angle > angleToAxis) {
                    angle = angleToAxis - CesiumMath.EPSILON4;
                }

                dot = Cartesian3.dot(p, Cartesian3.negate(constrainedAxis, rotateVertScratchNegate));
                angleToAxis = CesiumMath.acosClamped(dot);
                if (angle < 0 && -angle > angleToAxis) {
                    angle = -angleToAxis + CesiumMath.EPSILON4;
                }

                var tangent = Cartesian3.cross(constrainedAxis, p, rotateVertScratchTan);
                camera.rotate(tangent, angle);
            } else if ((northParallel && angle < 0) || (southParallel && angle > 0)) {
                camera.rotate(camera.right, angle);
            }
        } else {
            camera.rotate(camera.right, angle);
        }
    }

    /**
     * Rotates the camera around the center of the camera's reference frame by angle to the right.
     *
     * @param {Number} [angle] The angle, in radians, to rotate by. Defaults to <code>defaultRotateAmount</code>.
     *
     * @see Camera#rotateLeft
     * @see Camera#rotate
     */
    Camera.prototype.rotateRight = function(angle) {
        angle = defaultValue(angle, this.defaultRotateAmount);
        rotateHorizontal(this, -angle);
    };

    /**
     * Rotates the camera around the center of the camera's reference frame by angle to the left.
     *
     * @param {Number} [angle] The angle, in radians, to rotate by. Defaults to <code>defaultRotateAmount</code>.
     *
     * @see Camera#rotateRight
     * @see Camera#rotate
     */
    Camera.prototype.rotateLeft = function(angle) {
        angle = defaultValue(angle, this.defaultRotateAmount);
        rotateHorizontal(this, angle);
    };

    function rotateHorizontal(camera, angle) {
        if (defined(camera.constrainedAxis)) {
            camera.rotate(camera.constrainedAxis, angle);
        } else {
            camera.rotate(camera.up, angle);
        }
    }

    function zoom2D(camera, amount) {
        var frustum = camera.frustum;

        //>>includeStart('debug', pragmas.debug);
        if (!(frustum instanceof OrthographicOffCenterFrustum) || !defined(frustum.left) || !defined(frustum.right) ||
            !defined(frustum.bottom) || !defined(frustum.top)) {
            throw new DeveloperError('The camera frustum is expected to be orthographic for 2D camera control.');
        }
        //>>includeEnd('debug');

        var ratio;
        amount = amount * 0.5;

        if((Math.abs(frustum.top) + Math.abs(frustum.bottom)) > (Math.abs(frustum.left) + Math.abs(frustum.right))) {
            var newTop = frustum.top - amount;
            var newBottom = frustum.bottom + amount;

            var maxBottom = camera._maxCoord.y;
            if (camera._scene.mapMode2D === MapMode2D.ROTATE) {
                maxBottom *= camera.maximumZoomFactor;
            }

            if (newBottom > maxBottom) {
                newBottom = maxBottom;
                newTop = -maxBottom;
            }

            if (newTop <= newBottom) {
                newTop = 1.0;
                newBottom = -1.0;
            }

            ratio = frustum.right / frustum.top;
            frustum.top = newTop;
            frustum.bottom = newBottom;
            frustum.right = frustum.top * ratio;
            frustum.left = -frustum.right;
        } else {
            var newRight = frustum.right - amount;
            var newLeft = frustum.left + amount;

            var maxRight = camera._maxCoord.x;
            if (camera._scene.mapMode2D === MapMode2D.ROTATE) {
                maxRight *= camera.maximumZoomFactor;
            }

            if (newRight > maxRight) {
                newRight = maxRight;
                newLeft = -maxRight;
            }

            if (newRight <= newLeft) {
                newRight = 1.0;
                newLeft = -1.0;
            }
            ratio = frustum.top / frustum.right;
            frustum.right = newRight;
            frustum.left = newLeft;
            frustum.top = frustum.right * ratio;
            frustum.bottom = -frustum.top;
        }
    }

    function zoom3D(camera, amount) {
        camera.move(camera.direction, amount);
    }

    /**
     * Zooms <code>amount</code> along the camera's view vector.
     *
     * @param {Number} [amount] The amount to move. Defaults to <code>defaultZoomAmount</code>.
     *
     * @see Camera#zoomOut
     */
    Camera.prototype.zoomIn = function(amount) {
        amount = defaultValue(amount, this.defaultZoomAmount);
        if (this._mode === SceneMode.SCENE2D) {
            zoom2D(this, amount);
        } else {
            zoom3D(this, amount);
        }
    };

    /**
     * Zooms <code>amount</code> along the opposite direction of
     * the camera's view vector.
     *
     * @param {Number} [amount] The amount to move. Defaults to <code>defaultZoomAmount</code>.
     *
     * @see Camera#zoomIn
     */
    Camera.prototype.zoomOut = function(amount) {
        amount = defaultValue(amount, this.defaultZoomAmount);
        if (this._mode === SceneMode.SCENE2D) {
            zoom2D(this, -amount);
        } else {
            zoom3D(this, -amount);
        }
    };

    /**
     * Gets the magnitude of the camera position. In 3D, this is the vector magnitude. In 2D and
     * Columbus view, this is the distance to the map.
     *
     * @returns {Number} The magnitude of the position.
     */
    Camera.prototype.getMagnitude = function() {
        if (this._mode === SceneMode.SCENE3D) {
            return Cartesian3.magnitude(this.position);
        } else if (this._mode === SceneMode.COLUMBUS_VIEW) {
            return Math.abs(this.position.z);
        } else if (this._mode === SceneMode.SCENE2D) {
            return Math.max(this.frustum.right - this.frustum.left, this.frustum.top - this.frustum.bottom);
        }
    };

    var scratchLookAtMatrix4 = new Matrix4();

    /**
     * Sets the camera position and orientation using a target and offset. The target must be given in
     * world coordinates. The offset can be either a cartesian or heading/pitch/range in the local east-north-up reference frame centered at the target.
     * If the offset is a cartesian, then it is an offset from the center of the reference frame defined by the transformation matrix. If the offset
     * is heading/pitch/range, then the heading and the pitch angles are defined in the reference frame defined by the transformation matrix.
     * The heading is the angle from y axis and increasing towards the x axis. Pitch is the rotation from the xy-plane. Positive pitch
     * angles are below the plane. Negative pitch angles are above the plane. The range is the distance from the center.
     *
     * In 2D, there must be a top down view. The camera will be placed above the target looking down. The height above the
     * target will be the magnitude of the offset. The heading will be determined from the offset. If the heading cannot be
     * determined from the offset, the heading will be north.
     *
     * @param {Cartesian3} target The target position in world coordinates.
     * @param {Cartesian3|HeadingPitchRange} offset The offset from the target in the local east-north-up reference frame centered at the target.
     *
     * @exception {DeveloperError} lookAt is not supported while morphing.
     *
     * @example
     * // 1. Using a cartesian offset
     * var center = Cesium.Cartesian3.fromDegrees(-98.0, 40.0);
     * viewer.camera.lookAt(center, new Cesium.Cartesian3(0.0, -4790000.0, 3930000.0));
     *
     * // 2. Using a HeadingPitchRange offset
     * var center = Cesium.Cartesian3.fromDegrees(-72.0, 40.0);
     * var heading = Cesium.Math.toRadians(50.0);
     * var pitch = Cesium.Math.toRadians(-20.0);
     * var range = 5000.0;
     * viewer.camera.lookAt(center, new Cesium.HeadingPitchRange(heading, pitch, range));
     */
    Camera.prototype.lookAt = function(target, offset) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(target)) {
            throw new DeveloperError('target is required');
        }
        if (!defined(offset)) {
            throw new DeveloperError('offset is required');
        }
        if (this._mode === SceneMode.MORPHING) {
            throw new DeveloperError('lookAt is not supported while morphing.');
        }
        //>>includeEnd('debug');

        var transform = Transforms.eastNorthUpToFixedFrame(target, Ellipsoid.WGS84, scratchLookAtMatrix4);
        this.lookAtTransform(transform, offset);
    };

    var scratchLookAtHeadingPitchRangeOffset = new Cartesian3();
    var scratchLookAtHeadingPitchRangeQuaternion1 = new Quaternion();
    var scratchLookAtHeadingPitchRangeQuaternion2 = new Quaternion();
    var scratchHeadingPitchRangeMatrix3 = new Matrix3();

    function offsetFromHeadingPitchRange(heading, pitch, range) {
        pitch = CesiumMath.clamp(pitch, -CesiumMath.PI_OVER_TWO, CesiumMath.PI_OVER_TWO);
        heading = CesiumMath.zeroToTwoPi(heading) - CesiumMath.PI_OVER_TWO;

        var pitchQuat = Quaternion.fromAxisAngle(Cartesian3.UNIT_Y, -pitch, scratchLookAtHeadingPitchRangeQuaternion1);
        var headingQuat = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, -heading, scratchLookAtHeadingPitchRangeQuaternion2);
        var rotQuat = Quaternion.multiply(headingQuat, pitchQuat, headingQuat);
        var rotMatrix = Matrix3.fromQuaternion(rotQuat, scratchHeadingPitchRangeMatrix3);

        var offset = Cartesian3.clone(Cartesian3.UNIT_X, scratchLookAtHeadingPitchRangeOffset);
        Matrix3.multiplyByVector(rotMatrix, offset, offset);
        Cartesian3.negate(offset, offset);
        Cartesian3.multiplyByScalar(offset, range, offset);
        return offset;
    }

    /**
     * Sets the camera position and orientation using a target and transformation matrix. The offset can be either a cartesian or heading/pitch/range.
     * If the offset is a cartesian, then it is an offset from the center of the reference frame defined by the transformation matrix. If the offset
     * is heading/pitch/range, then the heading and the pitch angles are defined in the reference frame defined by the transformation matrix.
     * The heading is the angle from y axis and increasing towards the x axis. Pitch is the rotation from the xy-plane. Positive pitch
     * angles are below the plane. Negative pitch angles are above the plane. The range is the distance from the center.
     *
     * In 2D, there must be a top down view. The camera will be placed above the center of the reference frame. The height above the
     * target will be the magnitude of the offset. The heading will be determined from the offset. If the heading cannot be
     * determined from the offset, the heading will be north.
     *
     * @param {Matrix4} transform The transformation matrix defining the reference frame.
     * @param {Cartesian3|HeadingPitchRange} [offset] The offset from the target in a reference frame centered at the target.
     *
     * @exception {DeveloperError} lookAtTransform is not supported while morphing.
     *
     * @example
     * // 1. Using a cartesian offset
     * var transform = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(-98.0, 40.0));
     * viewer.camera.lookAtTransform(transform, new Cesium.Cartesian3(0.0, -4790000.0, 3930000.0));
     *
     * // 2. Using a HeadingPitchRange offset
     * var transform = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(-72.0, 40.0));
     * var heading = Cesium.Math.toRadians(50.0);
     * var pitch = Cesium.Math.toRadians(-20.0);
     * var range = 5000.0;
     * viewer.camera.lookAtTransform(transform, new Cesium.HeadingPitchRange(heading, pitch, range));
     */
    Camera.prototype.lookAtTransform = function(transform, offset) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(transform)) {
            throw new DeveloperError('transform is required');
        }
        if (this._mode === SceneMode.MORPHING) {
            throw new DeveloperError('lookAtTransform is not supported while morphing.');
        }
        //>>includeEnd('debug');

        this._setTransform(transform);
        if (!defined(offset)) {
            return;
        }

        var cartesianOffset;
        if (defined(offset.heading)) {
            cartesianOffset = offsetFromHeadingPitchRange(offset.heading, offset.pitch, offset.range);
        } else {
            cartesianOffset = offset;
        }

        if (this._mode === SceneMode.SCENE2D) {
            Cartesian2.clone(Cartesian2.ZERO, this.position);

            Cartesian3.negate(cartesianOffset, this.up);
            this.up.z = 0.0;

            if (Cartesian3.magnitudeSquared(this.up) < CesiumMath.EPSILON10) {
                Cartesian3.clone(Cartesian3.UNIT_Y, this.up);
            }

            Cartesian3.normalize(this.up, this.up);

            this._setTransform(Matrix4.IDENTITY);

            Cartesian3.negate(Cartesian3.UNIT_Z, this.direction);
            Cartesian3.cross(this.direction, this.up, this.right);
            Cartesian3.normalize(this.right, this.right);

            var frustum = this.frustum;
            var ratio = frustum.top / frustum.right;
            frustum.right = Cartesian3.magnitude(cartesianOffset) * 0.5;
            frustum.left = -frustum.right;
            frustum.top = ratio * frustum.right;
            frustum.bottom = -frustum.top;

            this._setTransform(transform);

            return;
        }

        Cartesian3.clone(cartesianOffset, this.position);
        Cartesian3.negate(this.position, this.direction);
        Cartesian3.normalize(this.direction, this.direction);
        Cartesian3.cross(this.direction, Cartesian3.UNIT_Z, this.right);

        if (Cartesian3.magnitudeSquared(this.right) < CesiumMath.EPSILON10) {
            Cartesian3.clone(Cartesian3.UNIT_X, this.right);
        }

        Cartesian3.normalize(this.right, this.right);
        Cartesian3.cross(this.right, this.direction, this.up);
        Cartesian3.normalize(this.up, this.up);

        this._adjustOrthographicFrustum(true);
    };

    var viewRectangle3DCartographic1 = new Cartographic();
    var viewRectangle3DCartographic2 = new Cartographic();
    var viewRectangle3DNorthEast = new Cartesian3();
    var viewRectangle3DSouthWest = new Cartesian3();
    var viewRectangle3DNorthWest = new Cartesian3();
    var viewRectangle3DSouthEast = new Cartesian3();
    var viewRectangle3DNorthCenter = new Cartesian3();
    var viewRectangle3DSouthCenter = new Cartesian3();
    var viewRectangle3DCenter = new Cartesian3();
    var viewRectangle3DEquator = new Cartesian3();
    var defaultRF = {
        direction : new Cartesian3(),
        right : new Cartesian3(),
        up : new Cartesian3()
    };
    var viewRectangle3DEllipsoidGeodesic;

    function computeD(direction, upOrRight, corner, tanThetaOrPhi) {
        var opposite = Math.abs(Cartesian3.dot(upOrRight, corner));
        return opposite / tanThetaOrPhi - Cartesian3.dot(direction, corner);
    }

    function rectangleCameraPosition3D(camera, rectangle, result, updateCamera) {
        var ellipsoid = camera._projection.ellipsoid;
        var cameraRF = updateCamera ? camera : defaultRF;

        var north = rectangle.north;
        var south = rectangle.south;
        var east = rectangle.east;
        var west = rectangle.west;

        // If we go across the International Date Line
        if (west > east) {
            east += CesiumMath.TWO_PI;
        }

        // Find the midpoint latitude.
        //
        // EllipsoidGeodesic will fail if the north and south edges are very close to being on opposite sides of the ellipsoid.
        // Ideally we'd just call EllipsoidGeodesic.setEndPoints and let it throw when it detects this case, but sadly it doesn't
        // even look for this case in optimized builds, so we have to test for it here instead.
        //
        // Fortunately, this case can only happen (here) when north is very close to the north pole and south is very close to the south pole,
        // so handle it just by using 0 latitude as the center.  It's certainliy possible to use a smaller tolerance
        // than one degree here, but one degree is safe and putting the center at 0 latitude should be good enough for any
        // rectangle that spans 178+ of the 180 degrees of latitude.
        var longitude = (west + east) * 0.5;
        var latitude;
        if (south < -CesiumMath.PI_OVER_TWO + CesiumMath.RADIANS_PER_DEGREE && north > CesiumMath.PI_OVER_TWO - CesiumMath.RADIANS_PER_DEGREE) {
            latitude = 0.0;
        } else {
            var northCartographic = viewRectangle3DCartographic1;
            northCartographic.longitude = longitude;
            northCartographic.latitude = north;
            northCartographic.height = 0.0;

            var southCartographic = viewRectangle3DCartographic2;
            southCartographic.longitude = longitude;
            southCartographic.latitude = south;
            southCartographic.height = 0.0;

            var ellipsoidGeodesic = viewRectangle3DEllipsoidGeodesic;
            if (!defined(ellipsoidGeodesic) || ellipsoidGeodesic.ellipsoid !== ellipsoid) {
                viewRectangle3DEllipsoidGeodesic = ellipsoidGeodesic = new EllipsoidGeodesic(undefined, undefined, ellipsoid);
            }

            ellipsoidGeodesic.setEndPoints(northCartographic, southCartographic);
            latitude = ellipsoidGeodesic.interpolateUsingFraction(0.5, viewRectangle3DCartographic1).latitude;
        }

        var centerCartographic = viewRectangle3DCartographic1;
        centerCartographic.longitude = longitude;
        centerCartographic.latitude = latitude;
        centerCartographic.height = 0.0;

        var center = ellipsoid.cartographicToCartesian(centerCartographic, viewRectangle3DCenter);

        var cart = viewRectangle3DCartographic1;
        cart.longitude = east;
        cart.latitude = north;
        var northEast = ellipsoid.cartographicToCartesian(cart, viewRectangle3DNorthEast);
        cart.longitude = west;
        var northWest = ellipsoid.cartographicToCartesian(cart, viewRectangle3DNorthWest);
        cart.longitude = longitude;
        var northCenter = ellipsoid.cartographicToCartesian(cart, viewRectangle3DNorthCenter);
        cart.latitude = south;
        var southCenter = ellipsoid.cartographicToCartesian(cart, viewRectangle3DSouthCenter);
        cart.longitude = east;
        var southEast = ellipsoid.cartographicToCartesian(cart, viewRectangle3DSouthEast);
        cart.longitude = west;
        var southWest = ellipsoid.cartographicToCartesian(cart, viewRectangle3DSouthWest);

        Cartesian3.subtract(northWest, center, northWest);
        Cartesian3.subtract(southEast, center, southEast);
        Cartesian3.subtract(northEast, center, northEast);
        Cartesian3.subtract(southWest, center, southWest);
        Cartesian3.subtract(northCenter, center, northCenter);
        Cartesian3.subtract(southCenter, center, southCenter);

        var direction = ellipsoid.geodeticSurfaceNormal(center, cameraRF.direction);
        Cartesian3.negate(direction, direction);
        var right = Cartesian3.cross(direction, Cartesian3.UNIT_Z, cameraRF.right);
        Cartesian3.normalize(right, right);
        var up = Cartesian3.cross(right, direction, cameraRF.up);

        var d;
        if (camera.frustum instanceof OrthographicFrustum) {
            var width = Math.max(Cartesian3.distance(northEast, northWest), Cartesian3.distance(southEast, southWest));
            var height = Math.max(Cartesian3.distance(northEast, southEast), Cartesian3.distance(northWest, southWest));

            var rightScalar;
            var topScalar;
            var ratio = camera.frustum._offCenterFrustum.right / camera.frustum._offCenterFrustum.top;
            var heightRatio = height * ratio;
            if (width > heightRatio) {
                rightScalar = width;
                topScalar = rightScalar / ratio;
            } else {
                topScalar = height;
                rightScalar = heightRatio;
            }

            d = Math.max(rightScalar, topScalar);
        } else {
            var tanPhi = Math.tan(camera.frustum.fovy * 0.5);
            var tanTheta = camera.frustum.aspectRatio * tanPhi;

            d = Math.max(
                computeD(direction, up, northWest, tanPhi),
                computeD(direction, up, southEast, tanPhi),
                computeD(direction, up, northEast, tanPhi),
                computeD(direction, up, southWest, tanPhi),
                computeD(direction, up, northCenter, tanPhi),
                computeD(direction, up, southCenter, tanPhi),
                computeD(direction, right, northWest, tanTheta),
                computeD(direction, right, southEast, tanTheta),
                computeD(direction, right, northEast, tanTheta),
                computeD(direction, right, southWest, tanTheta),
                computeD(direction, right, northCenter, tanTheta),
                computeD(direction, right, southCenter, tanTheta));

            // If the rectangle crosses the equator, compute D at the equator, too, because that's the
            // widest part of the rectangle when projected onto the globe.
            if (south < 0 && north > 0) {
                var equatorCartographic = viewRectangle3DCartographic1;
                equatorCartographic.longitude = west;
                equatorCartographic.latitude = 0.0;
                equatorCartographic.height = 0.0;
                var equatorPosition = ellipsoid.cartographicToCartesian(equatorCartographic, viewRectangle3DEquator);
                Cartesian3.subtract(equatorPosition, center, equatorPosition);
                d = Math.max(d, computeD(direction, up, equatorPosition, tanPhi), computeD(direction, right, equatorPosition, tanTheta));

                equatorCartographic.longitude = east;
                equatorPosition = ellipsoid.cartographicToCartesian(equatorCartographic, viewRectangle3DEquator);
                Cartesian3.subtract(equatorPosition, center, equatorPosition);
                d = Math.max(d, computeD(direction, up, equatorPosition, tanPhi), computeD(direction, right, equatorPosition, tanTheta));
            }
        }

        return Cartesian3.add(center, Cartesian3.multiplyByScalar(direction, -d, viewRectangle3DEquator), result);
    }

    var viewRectangleCVCartographic = new Cartographic();
    var viewRectangleCVNorthEast = new Cartesian3();
    var viewRectangleCVSouthWest = new Cartesian3();
    function rectangleCameraPositionColumbusView(camera, rectangle, result) {
        var projection = camera._projection;
        if (rectangle.west > rectangle.east) {
            rectangle = Rectangle.MAX_VALUE;
        }
        var transform = camera._actualTransform;
        var invTransform = camera._actualInvTransform;

        var cart = viewRectangleCVCartographic;
        cart.longitude = rectangle.east;
        cart.latitude = rectangle.north;
        var northEast = projection.project(cart, viewRectangleCVNorthEast);
        Matrix4.multiplyByPoint(transform, northEast, northEast);
        Matrix4.multiplyByPoint(invTransform, northEast, northEast);

        cart.longitude = rectangle.west;
        cart.latitude = rectangle.south;
        var southWest = projection.project(cart, viewRectangleCVSouthWest);
        Matrix4.multiplyByPoint(transform, southWest, southWest);
        Matrix4.multiplyByPoint(invTransform, southWest, southWest);

        result.x = (northEast.x - southWest.x) * 0.5 + southWest.x;
        result.y = (northEast.y - southWest.y) * 0.5 + southWest.y;

        if (defined(camera.frustum.fovy)) {
            var tanPhi = Math.tan(camera.frustum.fovy * 0.5);
            var tanTheta = camera.frustum.aspectRatio * tanPhi;
            result.z = Math.max((northEast.x - southWest.x) / tanTheta, (northEast.y - southWest.y) / tanPhi) * 0.5;
        } else {
            var width = northEast.x - southWest.x;
            var height = northEast.y - southWest.y;
            result.z = Math.max(width, height);
        }

        return result;
    }

    var viewRectangle2DCartographic = new Cartographic();
    var viewRectangle2DNorthEast = new Cartesian3();
    var viewRectangle2DSouthWest = new Cartesian3();
    function rectangleCameraPosition2D(camera, rectangle, result) {
        var projection = camera._projection;
        if (rectangle.west > rectangle.east) {
            rectangle = Rectangle.MAX_VALUE;
        }

        var cart = viewRectangle2DCartographic;
        cart.longitude = rectangle.east;
        cart.latitude = rectangle.north;
        var northEast = projection.project(cart, viewRectangle2DNorthEast);
        cart.longitude = rectangle.west;
        cart.latitude = rectangle.south;
        var southWest = projection.project(cart, viewRectangle2DSouthWest);

        var width = Math.abs(northEast.x - southWest.x) * 0.5;
        var height = Math.abs(northEast.y - southWest.y) * 0.5;

        var right, top;
        var ratio = camera.frustum.right / camera.frustum.top;
        var heightRatio = height * ratio;
        if (width > heightRatio) {
            right = width;
            top = right / ratio;
        } else {
            top = height;
            right = heightRatio;
        }

        height = Math.max(2.0 * right, 2.0 * top);

        result.x = (northEast.x - southWest.x) * 0.5 + southWest.x;
        result.y = (northEast.y - southWest.y) * 0.5 + southWest.y;

        cart = projection.unproject(result, cart);
        cart.height = height;
        result = projection.project(cart, result);

        return result;
    }

    /**
     * Get the camera position needed to view a rectangle on an ellipsoid or map
     *
     * @param {Rectangle} rectangle The rectangle to view.
     * @param {Cartesian3} [result] The camera position needed to view the rectangle
     * @returns {Cartesian3} The camera position needed to view the rectangle
     */
    Camera.prototype.getRectangleCameraCoordinates = function(rectangle, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(rectangle)) {
            throw new DeveloperError('rectangle is required');
        }
        //>>includeEnd('debug');
        var mode = this._mode;

        if (!defined(result)) {
            result = new Cartesian3();
        }

        if (mode === SceneMode.SCENE3D) {
            return rectangleCameraPosition3D(this, rectangle, result);
        } else if (mode === SceneMode.COLUMBUS_VIEW) {
            return rectangleCameraPositionColumbusView(this, rectangle, result);
        } else if (mode === SceneMode.SCENE2D) {
            return rectangleCameraPosition2D(this, rectangle, result);
        }

        return undefined;
    };

    var pickEllipsoid3DRay = new Ray();
    function pickEllipsoid3D(camera, windowPosition, ellipsoid, result) {
        ellipsoid = defaultValue(ellipsoid, Ellipsoid.WGS84);
        var ray = camera.getPickRay(windowPosition, pickEllipsoid3DRay);
        var intersection = IntersectionTests.rayEllipsoid(ray, ellipsoid);
        if (!intersection) {
            return undefined;
        }

        var t = intersection.start > 0.0 ? intersection.start : intersection.stop;
        return Ray.getPoint(ray, t, result);
    }

    var pickEllipsoid2DRay = new Ray();
    function pickMap2D(camera, windowPosition, projection, result) {
        var ray = camera.getPickRay(windowPosition, pickEllipsoid2DRay);
        var position = ray.origin;
        position.z = 0.0;
        var cart = projection.unproject(position);

        if (cart.latitude < -CesiumMath.PI_OVER_TWO || cart.latitude > CesiumMath.PI_OVER_TWO) {
            return undefined;
        }

        return projection.ellipsoid.cartographicToCartesian(cart, result);
    }

    var pickEllipsoidCVRay = new Ray();
    function pickMapColumbusView(camera, windowPosition, projection, result) {
        var ray = camera.getPickRay(windowPosition, pickEllipsoidCVRay);
        var scalar = -ray.origin.x / ray.direction.x;
        Ray.getPoint(ray, scalar, result);

        var cart = projection.unproject(new Cartesian3(result.y, result.z, 0.0));

        if (cart.latitude < -CesiumMath.PI_OVER_TWO || cart.latitude > CesiumMath.PI_OVER_TWO ||
            cart.longitude < -Math.PI || cart.longitude > Math.PI) {
            return undefined;
        }

        return projection.ellipsoid.cartographicToCartesian(cart, result);
    }

    /**
     * Pick an ellipsoid or map.
     *
     * @param {Cartesian2} windowPosition The x and y coordinates of a pixel.
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] The ellipsoid to pick.
     * @param {Cartesian3} [result] The object onto which to store the result.
     * @returns {Cartesian3} If the ellipsoid or map was picked, returns the point on the surface of the ellipsoid or map
     * in world coordinates. If the ellipsoid or map was not picked, returns undefined.
     */
    Camera.prototype.pickEllipsoid = function(windowPosition, ellipsoid, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(windowPosition)) {
            throw new DeveloperError('windowPosition is required.');
        }
        //>>includeEnd('debug');

        var canvas = this._scene.canvas;
        if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
            return undefined;
        }

        if (!defined(result)) {
            result = new Cartesian3();
        }

        ellipsoid = defaultValue(ellipsoid, Ellipsoid.WGS84);

        if (this._mode === SceneMode.SCENE3D) {
            result = pickEllipsoid3D(this, windowPosition, ellipsoid, result);
        } else if (this._mode === SceneMode.SCENE2D) {
            result = pickMap2D(this, windowPosition, this._projection, result);
        } else if (this._mode === SceneMode.COLUMBUS_VIEW) {
            result = pickMapColumbusView(this, windowPosition, this._projection, result);
        } else {
            return undefined;
        }

        return result;
    };

    var pickPerspCenter = new Cartesian3();
    var pickPerspXDir = new Cartesian3();
    var pickPerspYDir = new Cartesian3();
    function getPickRayPerspective(camera, windowPosition, result) {
        var canvas = camera._scene.canvas;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;

        var tanPhi = Math.tan(camera.frustum.fovy * 0.5);
        var tanTheta = camera.frustum.aspectRatio * tanPhi;
        var near = camera.frustum.near;

        var x = (2.0 / width) * windowPosition.x - 1.0;
        var y = (2.0 / height) * (height - windowPosition.y) - 1.0;

        var position = camera.positionWC;
        Cartesian3.clone(position, result.origin);

        var nearCenter = Cartesian3.multiplyByScalar(camera.directionWC, near, pickPerspCenter);
        Cartesian3.add(position, nearCenter, nearCenter);
        var xDir = Cartesian3.multiplyByScalar(camera.rightWC, x * near * tanTheta, pickPerspXDir);
        var yDir = Cartesian3.multiplyByScalar(camera.upWC, y * near * tanPhi, pickPerspYDir);
        var direction = Cartesian3.add(nearCenter, xDir, result.direction);
        Cartesian3.add(direction, yDir, direction);
        Cartesian3.subtract(direction, position, direction);
        Cartesian3.normalize(direction, direction);

        return result;
    }

    var scratchDirection = new Cartesian3();

    function getPickRayOrthographic(camera, windowPosition, result) {
        var canvas = camera._scene.canvas;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;

        var frustum = camera.frustum;
        if (defined(frustum._offCenterFrustum)) {
            frustum = frustum._offCenterFrustum;
        }
        var x = (2.0 / width) * windowPosition.x - 1.0;
        x *= (frustum.right - frustum.left) * 0.5;
        var y = (2.0 / height) * (height - windowPosition.y) - 1.0;
        y *= (frustum.top - frustum.bottom) * 0.5;

        var origin = result.origin;
        Cartesian3.clone(camera.position, origin);

        Cartesian3.multiplyByScalar(camera.right, x, scratchDirection);
        Cartesian3.add(scratchDirection, origin, origin);
        Cartesian3.multiplyByScalar(camera.up, y, scratchDirection);
        Cartesian3.add(scratchDirection, origin, origin);

        Cartesian3.clone(camera.directionWC, result.direction);

        if (camera._mode === SceneMode.COLUMBUS_VIEW) {
            Cartesian3.fromElements(result.origin.z, result.origin.x, result.origin.y, result.origin);
        }

        return result;
    }

    /**
     * Create a ray from the camera position through the pixel at <code>windowPosition</code>
     * in world coordinates.
     *
     * @param {Cartesian2} windowPosition The x and y coordinates of a pixel.
     * @param {Ray} [result] The object onto which to store the result.
     * @returns {Ray} Returns the {@link Cartesian3} position and direction of the ray.
     */
    Camera.prototype.getPickRay = function(windowPosition, result) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(windowPosition)) {
            throw new DeveloperError('windowPosition is required.');
        }
        //>>includeEnd('debug');

        if (!defined(result)) {
            result = new Ray();
        }

        var frustum = this.frustum;
        if (defined(frustum.aspectRatio) && defined(frustum.fov) && defined(frustum.near)) {
            return getPickRayPerspective(this, windowPosition, result);
        }

        return getPickRayOrthographic(this, windowPosition, result);
    };

    var scratchToCenter = new Cartesian3();
    var scratchProj = new Cartesian3();

    /**
     * Return the distance from the camera to the front of the bounding sphere.
     *
     * @param {BoundingSphere} boundingSphere The bounding sphere in world coordinates.
     * @returns {Number} The distance to the bounding sphere.
     */
    Camera.prototype.distanceToBoundingSphere = function(boundingSphere) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(boundingSphere)) {
            throw new DeveloperError('boundingSphere is required.');
        }
        //>>includeEnd('debug');

        var toCenter = Cartesian3.subtract(this.positionWC, boundingSphere.center, scratchToCenter);
        var proj = Cartesian3.multiplyByScalar(this.directionWC, Cartesian3.dot(toCenter, this.directionWC), scratchProj);
        return Math.max(0.0, Cartesian3.magnitude(proj) - boundingSphere.radius);
    };

    var scratchPixelSize = new Cartesian2();

    /**
     * Return the pixel size in meters.
     *
     * @param {BoundingSphere} boundingSphere The bounding sphere in world coordinates.
     * @param {Number} drawingBufferWidth The drawing buffer width.
     * @param {Number} drawingBufferHeight The drawing buffer height.
     * @returns {Number} The pixel size in meters.
     */
    Camera.prototype.getPixelSize = function(boundingSphere, drawingBufferWidth, drawingBufferHeight) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(boundingSphere)) {
            throw new DeveloperError('boundingSphere is required.');
        }
        if (!defined(drawingBufferWidth)) {
            throw new DeveloperError('drawingBufferWidth is required.');
        }
        if (!defined(drawingBufferHeight)) {
            throw new DeveloperError('drawingBufferHeight is required.');
        }
        //>>includeEnd('debug');

        var distance = this.distanceToBoundingSphere(boundingSphere);
        var pixelSize = this.frustum.getPixelDimensions(drawingBufferWidth, drawingBufferHeight, distance, scratchPixelSize);
        return Math.max(pixelSize.x, pixelSize.y);
    };

    function createAnimationTemplateCV(camera, position, center, maxX, maxY, duration) {
        var newPosition = Cartesian3.clone(position);

        if (center.y > maxX) {
            newPosition.y -= center.y - maxX;
        } else if (center.y < -maxX) {
            newPosition.y += -maxX - center.y;
        }

        if (center.z > maxY) {
            newPosition.z -= center.z - maxY;
        } else if (center.z < -maxY) {
            newPosition.z += -maxY - center.z;
        }

        function updateCV(value) {
            var interp = Cartesian3.lerp(position, newPosition, value.time, new Cartesian3());
            camera.worldToCameraCoordinatesPoint(interp, camera.position);
        }
        return {
            easingFunction : EasingFunction.EXPONENTIAL_OUT,
            startObject : {
                time : 0.0
            },
            stopObject : {
                time : 1.0
            },
            duration : duration,
            update : updateCV
        };
    }

    var normalScratch = new Cartesian3();
    var centerScratch = new Cartesian3();
    var posScratch = new Cartesian3();
    var scratchCartesian3Subtract = new Cartesian3();

    function createAnimationCV(camera, duration) {
        var position = camera.position;
        var direction = camera.direction;

        var normal = camera.worldToCameraCoordinatesVector(Cartesian3.UNIT_X, normalScratch);
        var scalar = -Cartesian3.dot(normal, position) / Cartesian3.dot(normal, direction);
        var center = Cartesian3.add(position, Cartesian3.multiplyByScalar(direction, scalar, centerScratch), centerScratch);
        camera.cameraToWorldCoordinatesPoint(center, center);

        position = camera.cameraToWorldCoordinatesPoint(camera.position, posScratch);

        var tanPhi = Math.tan(camera.frustum.fovy * 0.5);
        var tanTheta = camera.frustum.aspectRatio * tanPhi;
        var distToC = Cartesian3.magnitude(Cartesian3.subtract(position, center, scratchCartesian3Subtract));
        var dWidth = tanTheta * distToC;
        var dHeight = tanPhi * distToC;

        var mapWidth = camera._maxCoord.x;
        var mapHeight = camera._maxCoord.y;

        var maxX = Math.max(dWidth - mapWidth, mapWidth);
        var maxY = Math.max(dHeight - mapHeight, mapHeight);

        if (position.z < -maxX || position.z > maxX || position.y < -maxY || position.y > maxY) {
            var translateX = center.y < -maxX || center.y > maxX;
            var translateY = center.z < -maxY || center.z > maxY;
            if (translateX || translateY) {
                return createAnimationTemplateCV(camera, position, center, maxX, maxY, duration);
            }
        }

        return undefined;
    }

    /**
     * Create an animation to move the map into view. This method is only valid for 2D and Columbus modes.
     *
     * @param {Number} duration The duration, in seconds, of the animation.
     * @returns {Object} The animation or undefined if the scene mode is 3D or the map is already ion view.
     *
     * @private
     */
    Camera.prototype.createCorrectPositionTween = function(duration) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(duration)) {
            throw new DeveloperError('duration is required.');
        }
        //>>includeEnd('debug');

        if (this._mode === SceneMode.COLUMBUS_VIEW) {
            return createAnimationCV(this, duration);
        }

        return undefined;
    };

    var scratchFlyToDestination = new Cartesian3();
    var newOptions = {
        destination : undefined,
        heading : undefined,
        pitch : undefined,
        roll : undefined,
        duration : undefined,
        complete : undefined,
        cancel : undefined,
        endTransform : undefined,
        maximumHeight : undefined,
        easingFunction : undefined
    };

    /**
     * Cancels the current camera flight if one is in progress.
     * The camera is left at it's current location.
     */
    Camera.prototype.cancelFlight = function () {
        if (defined(this._currentFlight)) {
            this._currentFlight.cancelTween();
            this._currentFlight = undefined;
        }
    };

    /**
     * Flies the camera from its current position to a new position.
     *
     * @param {Object} options Object with the following properties:
     * @param {Cartesian3|Rectangle} options.destination The final position of the camera in WGS84 (world) coordinates or a rectangle that would be visible from a top-down view.
     * @param {Object} [options.orientation] An object that contains either direction and up properties or heading, pith and roll properties. By default, the direction will point
     * towards the center of the frame in 3D and in the negative z direction in Columbus view. The up direction will point towards local north in 3D and in the positive
     * y direction in Columbus view.  Orientation is not used in 2D when in infinite scrolling mode.
     * @param {Number} [options.duration] The duration of the flight in seconds. If omitted, Cesium attempts to calculate an ideal duration based on the distance to be traveled by the flight.
     * @param {Camera~FlightCompleteCallback} [options.complete] The function to execute when the flight is complete.
     * @param {Camera~FlightCancelledCallback} [options.cancel] The function to execute if the flight is cancelled.
     * @param {Matrix4} [options.endTransform] Transform matrix representing the reference frame the camera will be in when the flight is completed.
     * @param {Number} [options.maximumHeight] The maximum height at the peak of the flight.
     * @param {Number} [options.pitchAdjustHeight] If camera flyes higher than that value, adjust pitch duiring the flight to look down, and keep Earth in viewport.
     * @param {Number} [options.flyOverLongitude] There are always two ways between 2 points on globe. This option force camera to choose fight direction to fly over that longitude.
     * @param {Number} [options.flyOverLongitudeWeight] Fly over the lon specifyed via flyOverLongitude only if that way is not longer than short way times flyOverLongitudeWeight.
     * @param {EasingFunction|EasingFunction~Callback} [options.easingFunction] Controls how the time is interpolated over the duration of the flight.
     *
     * @exception {DeveloperError} If either direction or up is given, then both are required.
     *
     * @example
     * // 1. Fly to a position with a top-down view
     * viewer.camera.flyTo({
     *     destination : Cesium.Cartesian3.fromDegrees(-117.16, 32.71, 15000.0)
     * });
     *
     * // 2. Fly to a Rectangle with a top-down view
     * viewer.camera.flyTo({
     *     destination : Cesium.Rectangle.fromDegrees(west, south, east, north)
     * });
     *
     * // 3. Fly to a position with an orientation using unit vectors.
     * viewer.camera.flyTo({
     *     destination : Cesium.Cartesian3.fromDegrees(-122.19, 46.25, 5000.0),
     *     orientation : {
     *         direction : new Cesium.Cartesian3(-0.04231243104240401, -0.20123236049443421, -0.97862924300734),
     *         up : new Cesium.Cartesian3(-0.47934589305293746, -0.8553216253114552, 0.1966022179118339)
     *     }
     * });
     *
     * // 4. Fly to a position with an orientation using heading, pitch and roll.
     * viewer.camera.flyTo({
     *     destination : Cesium.Cartesian3.fromDegrees(-122.19, 46.25, 5000.0),
     *     orientation : {
     *         heading : Cesium.Math.toRadians(175.0),
     *         pitch : Cesium.Math.toRadians(-35.0),
     *         roll : 0.0
     *     }
     * });
     */
    Camera.prototype.flyTo = function(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        var destination = options.destination;
        //>>includeStart('debug', pragmas.debug);
        if (!defined(destination)) {
            throw new DeveloperError('destination is required.');
        }
        //>>includeEnd('debug');

        var mode = this._mode;
        if (mode === SceneMode.MORPHING) {
            return;
        }

        this.cancelFlight();

        var orientation = defaultValue(options.orientation, defaultValue.EMPTY_OBJECT);
        if (defined(orientation.direction)) {
            orientation = directionUpToHeadingPitchRoll(this, destination, orientation, scratchSetViewOptions.orientation);
        }

        if (defined(options.duration) && options.duration <= 0.0) {
            var setViewOptions = scratchSetViewOptions;
            setViewOptions.destination = options.destination;
            setViewOptions.orientation.heading = orientation.heading;
            setViewOptions.orientation.pitch = orientation.pitch;
            setViewOptions.orientation.roll = orientation.roll;
            setViewOptions.convert = options.convert;
            setViewOptions.endTransform = options.endTransform;
            this.setView(setViewOptions);
            if (typeof options.complete === 'function') {
                options.complete();
            }
            return;
        }

        var isRectangle = defined(destination.west);
        if (isRectangle) {
            destination = this.getRectangleCameraCoordinates(destination, scratchFlyToDestination);
        }

        var that = this;
        var flightTween;

        newOptions.destination = destination;
        newOptions.heading = orientation.heading;
        newOptions.pitch = orientation.pitch;
        newOptions.roll = orientation.roll;
        newOptions.duration = options.duration;
        newOptions.complete = function () {
            if(flightTween === that._currentFlight){
                that._currentFlight = undefined;
            }
            if (defined(options.complete)) {
                options.complete();
            }
        };
        newOptions.cancel = options.cancel;
        newOptions.endTransform = options.endTransform;
        newOptions.convert = isRectangle ? false : options.convert;
        newOptions.maximumHeight = options.maximumHeight;
        newOptions.pitchAdjustHeight = options.pitchAdjustHeight;
        newOptions.flyOverLongitude = options.flyOverLongitude;
        newOptions.flyOverLongitudeWeight = options.flyOverLongitudeWeight;
        newOptions.easingFunction = options.easingFunction;

        var scene = this._scene;
        flightTween = scene.tweens.add(CameraFlightPath.createTween(scene, newOptions));
        this._currentFlight = flightTween;
    };

    function distanceToBoundingSphere3D(camera, radius) {
        var frustum = camera.frustum;
        var tanPhi = Math.tan(frustum.fovy * 0.5);
        var tanTheta = frustum.aspectRatio * tanPhi;
        return Math.max(radius / tanTheta, radius / tanPhi);
    }

    function distanceToBoundingSphere2D(camera, radius) {
        var frustum = camera.frustum;
        if (defined(frustum._offCenterFrustum)) {
            frustum = frustum._offCenterFrustum;
        }

        var right, top;
        var ratio = frustum.right / frustum.top;
        var heightRatio = radius * ratio;
        if (radius > heightRatio) {
            right = radius;
            top = right / ratio;
        } else {
            top = radius;
            right = heightRatio;
        }

        return Math.max(right, top) * 1.50;
    }

    var MINIMUM_ZOOM = 100.0;

    function adjustBoundingSphereOffset(camera, boundingSphere, offset) {
        if (!defined(offset)) {
            offset = HeadingPitchRange.clone(Camera.DEFAULT_OFFSET);
        }

        var minimumZoom = camera._scene.screenSpaceCameraController.minimumZoomDistance;
        var maximumZoom = camera._scene.screenSpaceCameraController.maximumZoomDistance;
        var range = offset.range;
        if (!defined(range) || range === 0.0) {
            var radius = boundingSphere.radius;
            if (radius === 0.0) {
                offset.range = MINIMUM_ZOOM;
            } else if (camera.frustum instanceof OrthographicFrustum || camera._mode === SceneMode.SCENE2D) {
                offset.range = distanceToBoundingSphere2D(camera, radius);
            } else {
                offset.range = distanceToBoundingSphere3D(camera, radius);
            }
            offset.range = CesiumMath.clamp(offset.range, minimumZoom, maximumZoom);
        }

        return offset;
    }

    /**
     * Sets the camera so that the current view contains the provided bounding sphere.
     *
     * <p>The offset is heading/pitch/range in the local east-north-up reference frame centered at the center of the bounding sphere.
     * The heading and the pitch angles are defined in the local east-north-up reference frame.
     * The heading is the angle from y axis and increasing towards the x axis. Pitch is the rotation from the xy-plane. Positive pitch
     * angles are below the plane. Negative pitch angles are above the plane. The range is the distance from the center. If the range is
     * zero, a range will be computed such that the whole bounding sphere is visible.</p>
     *
     * <p>In 2D, there must be a top down view. The camera will be placed above the target looking down. The height above the
     * target will be the range. The heading will be determined from the offset. If the heading cannot be
     * determined from the offset, the heading will be north.</p>
     *
     * @param {BoundingSphere} boundingSphere The bounding sphere to view, in world coordinates.
     * @param {HeadingPitchRange} [offset] The offset from the target in the local east-north-up reference frame centered at the target.
     *
     * @exception {DeveloperError} viewBoundingSphere is not supported while morphing.
     */
    Camera.prototype.viewBoundingSphere = function(boundingSphere, offset) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(boundingSphere)) {
            throw new DeveloperError('boundingSphere is required.');
        }

        if (this._mode === SceneMode.MORPHING) {
            throw new DeveloperError('viewBoundingSphere is not supported while morphing.');
        }
        //>>includeEnd('debug');

        offset = adjustBoundingSphereOffset(this, boundingSphere, offset);
        this.lookAt(boundingSphere.center, offset);
    };

    var scratchflyToBoundingSphereTransform = new Matrix4();
    var scratchflyToBoundingSphereDestination = new Cartesian3();
    var scratchflyToBoundingSphereDirection = new Cartesian3();
    var scratchflyToBoundingSphereUp = new Cartesian3();
    var scratchflyToBoundingSphereRight = new Cartesian3();
    var scratchFlyToBoundingSphereCart4 = new Cartesian4();
    var scratchFlyToBoundingSphereQuaternion = new Quaternion();
    var scratchFlyToBoundingSphereMatrix3 = new Matrix3();

    /**
     * Flies the camera to a location where the current view contains the provided bounding sphere.
     *
     * <p> The offset is heading/pitch/range in the local east-north-up reference frame centered at the center of the bounding sphere.
     * The heading and the pitch angles are defined in the local east-north-up reference frame.
     * The heading is the angle from y axis and increasing towards the x axis. Pitch is the rotation from the xy-plane. Positive pitch
     * angles are below the plane. Negative pitch angles are above the plane. The range is the distance from the center. If the range is
     * zero, a range will be computed such that the whole bounding sphere is visible.</p>
     *
     * <p>In 2D and Columbus View, there must be a top down view. The camera will be placed above the target looking down. The height above the
     * target will be the range. The heading will be aligned to local north.</p>
     *
     * @param {BoundingSphere} boundingSphere The bounding sphere to view, in world coordinates.
     * @param {Object} [options] Object with the following properties:
     * @param {Number} [options.duration] The duration of the flight in seconds. If omitted, Cesium attempts to calculate an ideal duration based on the distance to be traveled by the flight.
     * @param {HeadingPitchRange} [options.offset] The offset from the target in the local east-north-up reference frame centered at the target.
     * @param {Camera~FlightCompleteCallback} [options.complete] The function to execute when the flight is complete.
     * @param {Camera~FlightCancelledCallback} [options.cancel] The function to execute if the flight is cancelled.
     * @param {Matrix4} [options.endTransform] Transform matrix representing the reference frame the camera will be in when the flight is completed.
     * @param {Number} [options.maximumHeight] The maximum height at the peak of the flight.
     * @param {Number} [options.pitchAdjustHeight] If camera flyes higher than that value, adjust pitch duiring the flight to look down, and keep Earth in viewport.
     * @param {Number} [options.flyOverLongitude] There are always two ways between 2 points on globe. This option force camera to choose fight direction to fly over that longitude.
     * @param {Number} [options.flyOverLongitudeWeight] Fly over the lon specifyed via flyOverLongitude only if that way is not longer than short way times flyOverLongitudeWeight.
     * @param {EasingFunction|EasingFunction~Callback} [options.easingFunction] Controls how the time is interpolated over the duration of the flight.
     */
    Camera.prototype.flyToBoundingSphere = function(boundingSphere, options) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(boundingSphere)) {
            throw new DeveloperError('boundingSphere is required.');
        }
        //>>includeEnd('debug');

        options = defaultValue(options, defaultValue.EMPTY_OBJECT);
        var scene2D = this._mode === SceneMode.SCENE2D || this._mode === SceneMode.COLUMBUS_VIEW;
        this._setTransform(Matrix4.IDENTITY);
        var offset = adjustBoundingSphereOffset(this, boundingSphere, options.offset);

        var position;
        if (scene2D) {
            position = Cartesian3.multiplyByScalar(Cartesian3.UNIT_Z, offset.range, scratchflyToBoundingSphereDestination);
        } else {
            position = offsetFromHeadingPitchRange(offset.heading, offset.pitch, offset.range);
        }

        var transform = Transforms.eastNorthUpToFixedFrame(boundingSphere.center, Ellipsoid.WGS84, scratchflyToBoundingSphereTransform);
        Matrix4.multiplyByPoint(transform, position, position);

        var direction;
        var up;

        if (!scene2D) {
            direction = Cartesian3.subtract(boundingSphere.center, position, scratchflyToBoundingSphereDirection);
            Cartesian3.normalize(direction, direction);

            up = Matrix4.multiplyByPointAsVector(transform, Cartesian3.UNIT_Z, scratchflyToBoundingSphereUp);
            if (1.0 - Math.abs(Cartesian3.dot(direction, up)) < CesiumMath.EPSILON6) {
                var rotateQuat = Quaternion.fromAxisAngle(direction, offset.heading, scratchFlyToBoundingSphereQuaternion);
                var rotation = Matrix3.fromQuaternion(rotateQuat, scratchFlyToBoundingSphereMatrix3);

                Cartesian3.fromCartesian4(Matrix4.getColumn(transform, 1, scratchFlyToBoundingSphereCart4), up);
                Matrix3.multiplyByVector(rotation, up, up);
            }

            var right = Cartesian3.cross(direction, up, scratchflyToBoundingSphereRight);
            Cartesian3.cross(right, direction, up);
            Cartesian3.normalize(up, up);
        }

        this.flyTo({
            destination : position,
            orientation : {
                direction : direction,
                up : up
            },
            duration : options.duration,
            complete : options.complete,
            cancel : options.cancel,
            endTransform : options.endTransform,
            maximumHeight : options.maximumHeight,
            easingFunction : options.easingFunction,
            flyOverLongitude : options.flyOverLongitude,
            flyOverLongitudeWeight : options.flyOverLongitudeWeight,
            pitchAdjustHeight : options.pitchAdjustHeight
        });
    };

    var scratchCartesian3_1 = new Cartesian3();
    var scratchCartesian3_2 = new Cartesian3();
    var scratchCartesian3_3 = new Cartesian3();
    var scratchCartesian3_4 = new Cartesian3();
    var horizonPoints = [new Cartesian3(), new Cartesian3(), new Cartesian3(), new Cartesian3()];

    function computeHorizonQuad(camera, ellipsoid) {
        var radii = ellipsoid.radii;
        var p = camera.positionWC;

        // Find the corresponding position in the scaled space of the ellipsoid.
        var q = Cartesian3.multiplyComponents(ellipsoid.oneOverRadii, p, scratchCartesian3_1);

        var qMagnitude = Cartesian3.magnitude(q);
        var qUnit = Cartesian3.normalize(q, scratchCartesian3_2);

        // Determine the east and north directions at q.
        var eUnit;
        var nUnit;
        if (Cartesian3.equalsEpsilon(qUnit, Cartesian3.UNIT_Z, CesiumMath.EPSILON10)) {
            eUnit = new Cartesian3(0, 1, 0);
            nUnit = new Cartesian3(0, 0, 1);
        } else {
            eUnit = Cartesian3.normalize(Cartesian3.cross(Cartesian3.UNIT_Z, qUnit, scratchCartesian3_3), scratchCartesian3_3);
            nUnit = Cartesian3.normalize(Cartesian3.cross(qUnit, eUnit, scratchCartesian3_4), scratchCartesian3_4);
        }

        // Determine the radius of the 'limb' of the ellipsoid.
        var wMagnitude = Math.sqrt(Cartesian3.magnitudeSquared(q) - 1.0);

        // Compute the center and offsets.
        var center = Cartesian3.multiplyByScalar(qUnit, 1.0 / qMagnitude, scratchCartesian3_1);
        var scalar = wMagnitude / qMagnitude;
        var eastOffset = Cartesian3.multiplyByScalar(eUnit, scalar, scratchCartesian3_2);
        var northOffset = Cartesian3.multiplyByScalar(nUnit, scalar, scratchCartesian3_3);

        // A conservative measure for the longitudes would be to use the min/max longitudes of the bounding frustum.
        var upperLeft = Cartesian3.add(center, northOffset, horizonPoints[0]);
        Cartesian3.subtract(upperLeft, eastOffset, upperLeft);
        Cartesian3.multiplyComponents(radii, upperLeft, upperLeft);

        var lowerLeft = Cartesian3.subtract(center, northOffset, horizonPoints[1]);
        Cartesian3.subtract(lowerLeft, eastOffset, lowerLeft);
        Cartesian3.multiplyComponents(radii, lowerLeft, lowerLeft);

        var lowerRight = Cartesian3.subtract(center, northOffset, horizonPoints[2]);
        Cartesian3.add(lowerRight, eastOffset, lowerRight);
        Cartesian3.multiplyComponents(radii, lowerRight, lowerRight);

        var upperRight = Cartesian3.add(center, northOffset, horizonPoints[3]);
        Cartesian3.add(upperRight, eastOffset, upperRight);
        Cartesian3.multiplyComponents(radii, upperRight, upperRight);

        return horizonPoints;
    }

    var scratchPickCartesian2 = new Cartesian2();
    var scratchRectCartesian = new Cartesian3();
    var cartoArray = [new Cartographic(), new Cartographic(), new Cartographic(), new Cartographic()];
    function addToResult(x, y, index, camera, ellipsoid, computedHorizonQuad) {
        scratchPickCartesian2.x = x;
        scratchPickCartesian2.y = y;
        var r = camera.pickEllipsoid(scratchPickCartesian2, ellipsoid, scratchRectCartesian);
        if (defined(r)) {
            cartoArray[index] = ellipsoid.cartesianToCartographic(r, cartoArray[index]);
            return 1;
        }
        cartoArray[index] = ellipsoid.cartesianToCartographic(computedHorizonQuad[index], cartoArray[index]);
        return 0;
    }
    /**
     * Computes the approximate visible rectangle on the ellipsoid.
     *
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] The ellipsoid that you want to know the visible region.
     * @param {Rectangle} [result] The rectangle in which to store the result
     *
     * @returns {Rectangle|undefined} The visible rectangle or undefined if the ellipsoid isn't visible at all.
     */
    Camera.prototype.computeViewRectangle = function(ellipsoid, result) {
        ellipsoid = defaultValue(ellipsoid, Ellipsoid.WGS84);
        var cullingVolume = this.frustum.computeCullingVolume(this.positionWC, this.directionWC, this.upWC);
        var boundingSphere = new BoundingSphere(Cartesian3.ZERO, ellipsoid.maximumRadius);
        var visibility = cullingVolume.computeVisibility(boundingSphere);
        if (visibility === Intersect.OUTSIDE) {
            return undefined;
        }

        var canvas = this._scene.canvas;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;

        var successfulPickCount = 0;

        var computedHorizonQuad = computeHorizonQuad(this, ellipsoid);

        successfulPickCount += addToResult(0, 0, 0, this, ellipsoid, computedHorizonQuad);
        successfulPickCount += addToResult(0, height, 1, this, ellipsoid, computedHorizonQuad);
        successfulPickCount += addToResult(width, height, 2, this, ellipsoid, computedHorizonQuad);
        successfulPickCount += addToResult(width, 0, 3, this, ellipsoid, computedHorizonQuad);

        if (successfulPickCount < 2) {
            // If we have space non-globe in 3 or 4 corners then return the whole globe
            return Rectangle.MAX_VALUE;
        }

        result = Rectangle.fromCartographicArray(cartoArray, result);

        // Detect if we go over the poles
        var distance = 0;
        var lastLon = cartoArray[3].longitude;
        for (var i = 0; i < 4; ++i) {
            var lon = cartoArray[i].longitude;
            var diff = Math.abs(lon - lastLon);
            if (diff > CesiumMath.PI) {
                // Crossed the dateline
                distance += CesiumMath.TWO_PI - diff;
            } else {
                distance += diff;
            }

            lastLon = lon;
        }

        // We are over one of the poles so adjust the rectangle accordingly
        if (CesiumMath.equalsEpsilon(Math.abs(distance), CesiumMath.TWO_PI, CesiumMath.EPSILON9)) {
            result.west = -CesiumMath.PI;
            result.east = CesiumMath.PI;
            if (cartoArray[0].latitude >= 0.0) {
                result.north = CesiumMath.PI_OVER_TWO;
            } else {
                result.south = -CesiumMath.PI_OVER_TWO;
            }
        }

        return result;
    };

    /**
     * Switches the frustum/projection to perspective.
     *
     * This function is a no-op in 2D which must always be orthographic.
     */
    Camera.prototype.switchToPerspectiveFrustum = function() {
        if (this._mode === SceneMode.SCENE2D || this.frustum instanceof PerspectiveFrustum) {
            return;
        }

        var scene = this._scene;
        this.frustum = new PerspectiveFrustum();
        this.frustum.aspectRatio = scene.drawingBufferWidth / scene.drawingBufferHeight;
        this.frustum.fov = CesiumMath.toRadians(60.0);
    };

    /**
     * Switches the frustum/projection to orthographic.
     *
     * This function is a no-op in 2D which will always be orthographic.
     */
    Camera.prototype.switchToOrthographicFrustum = function() {
        if (this._mode === SceneMode.SCENE2D || this.frustum instanceof OrthographicFrustum) {
            return;
        }

        var scene = this._scene;
        this.frustum = new OrthographicFrustum();
        this.frustum.aspectRatio = scene.drawingBufferWidth / scene.drawingBufferHeight;

        // It doesn't matter what we set this to. The adjust below will correct the width based on the camera position.
        this.frustum.width = Cartesian3.magnitude(this.position);

        // Check the projection matrix. It will always be defined, but we need to force an off-center update.
        var projectionMatrix = this.frustum.projectionMatrix;
        if (defined(projectionMatrix)) {
            this._adjustOrthographicFrustum(true);
        }
    };

    /**
     * @private
     */
    Camera.clone = function(camera, result) {
        if (!defined(result)) {
            result = new Camera(camera._scene);
        }

        Cartesian3.clone(camera.position, result.position);
        Cartesian3.clone(camera.direction, result.direction);
        Cartesian3.clone(camera.up, result.up);
        Cartesian3.clone(camera.right, result.right);
        Matrix4.clone(camera._transform, result.transform);
        result._transformChanged = true;

        return result;
    };

    /**
     * A function that will execute when a flight completes.
     * @callback Camera~FlightCompleteCallback
     */

    /**
     * A function that will execute when a flight is cancelled.
     * @callback Camera~FlightCancelledCallback
     */

    //return Camera;
	Cesium.GeoCamera = Camera;
//});

	
})(window.Cesium);
(function(Cesium){
/*
define([
        '../Core/Cartesian2',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/KeyboardEventModifier',
        '../Core/Math',
        '../Core/ScreenSpaceEventHandler',
        '../Core/ScreenSpaceEventType',
        './CameraEventType'
    ], function(
        Cartesian2,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        KeyboardEventModifier,
        CesiumMath,
        ScreenSpaceEventHandler,
        ScreenSpaceEventType,
        CameraEventType) {
*/
	'use strict';
	
	//文件末尾处定义类名

    var Cartesian2 = Cesium.Cartesian2;
    var defined = Cesium.defined;
    var defineProperties = Cesium.defineProperties;
	var destroyObject = Cesium.destroyObject;
	var DeveloperError = Cesium.DeveloperError;
	var KeyboardEventModifier = Cesium.KeyboardEventModifier;
    var CesiumMath = Cesium.Math;
    var ScreenSpaceEventHandler = Cesium.ScreenSpaceEventHandler;
    var ScreenSpaceEventType = Cesium.ScreenSpaceEventType;
    var CameraEventType = Cesium.CameraEventType;
		
    function getKey(type, modifier) {
        var key = type;
        if (defined(modifier)) {
            key += '+' + modifier;
        }
        return key;
    }

    function clonePinchMovement(pinchMovement, result) {
        Cartesian2.clone(pinchMovement.distance.startPosition, result.distance.startPosition);
        Cartesian2.clone(pinchMovement.distance.endPosition, result.distance.endPosition);

        Cartesian2.clone(pinchMovement.angleAndHeight.startPosition, result.angleAndHeight.startPosition);
        Cartesian2.clone(pinchMovement.angleAndHeight.endPosition, result.angleAndHeight.endPosition);
    }

    function listenToPinch(aggregator, modifier, canvas) {
        var key = getKey(CameraEventType.PINCH, modifier);

        var update = aggregator._update;
        var isDown = aggregator._isDown;
        var eventStartPosition = aggregator._eventStartPosition;
        var pressTime = aggregator._pressTime;
        var releaseTime = aggregator._releaseTime;

        update[key] = true;
        isDown[key] = false;
        eventStartPosition[key] = new Cartesian2();

        var movement = aggregator._movement[key];
        if (!defined(movement)) {
            movement = aggregator._movement[key] = {};
        }

        movement.distance = {
            startPosition : new Cartesian2(),
            endPosition : new Cartesian2()
        };
        movement.angleAndHeight = {
            startPosition : new Cartesian2(),
            endPosition : new Cartesian2()
        };
        movement.prevAngle = 0.0;

        aggregator._eventHandler.setInputAction(function(event) {
            aggregator._buttonsDown++;
            isDown[key] = true;
            pressTime[key] = new Date();
            // Compute center position and store as start point.
            Cartesian2.lerp(event.position1, event.position2, 0.5, eventStartPosition[key]);
        }, ScreenSpaceEventType.PINCH_START, modifier);

        aggregator._eventHandler.setInputAction(function() {
            aggregator._buttonsDown = Math.max(aggregator._buttonsDown - 1, 0);
            isDown[key] = false;
            releaseTime[key] = new Date();
        }, ScreenSpaceEventType.PINCH_END, modifier);

        aggregator._eventHandler.setInputAction(function(mouseMovement) {
            if (isDown[key]) {
                // Aggregate several input events into a single animation frame.
                if (!update[key]) {
                    Cartesian2.clone(mouseMovement.distance.endPosition, movement.distance.endPosition);
                    Cartesian2.clone(mouseMovement.angleAndHeight.endPosition, movement.angleAndHeight.endPosition);
                } else {
                    clonePinchMovement(mouseMovement, movement);
                    update[key] = false;
                    movement.prevAngle = movement.angleAndHeight.startPosition.x;
                }
                // Make sure our aggregation of angles does not "flip" over 360 degrees.
                var angle = movement.angleAndHeight.endPosition.x;
                var prevAngle = movement.prevAngle;
                var TwoPI = Math.PI * 2;
                while (angle >= (prevAngle + Math.PI)) {
                    angle -= TwoPI;
                }
                while (angle < (prevAngle - Math.PI)) {
                    angle += TwoPI;
                }
                movement.angleAndHeight.endPosition.x = -angle * canvas.clientWidth / 12;
                movement.angleAndHeight.startPosition.x = -prevAngle * canvas.clientWidth / 12;
            }
        }, ScreenSpaceEventType.PINCH_MOVE, modifier);
    }

    function listenToWheel(aggregator, modifier) {
        var key = getKey(CameraEventType.WHEEL, modifier);

        var update = aggregator._update;
        update[key] = true;

        var movement = aggregator._movement[key];
        if (!defined(movement)) {
            movement = aggregator._movement[key] = {};
        }

        movement.startPosition = new Cartesian2();
        movement.endPosition = new Cartesian2();

        aggregator._eventHandler.setInputAction(function(delta) {
            // TODO: magic numbers
            //zhangli2018
            //var arcLength = 15.0 * CesiumMath.toRadians(delta);
            var arcLength = 10.0 * CesiumMath.toRadians(delta);
            if (!update[key]) {
                movement.endPosition.y = movement.endPosition.y + arcLength;
            } else {
                Cartesian2.clone(Cartesian2.ZERO, movement.startPosition);
                movement.endPosition.x = 0.0;
                movement.endPosition.y = arcLength;
                update[key] = false;
            }
        }, ScreenSpaceEventType.WHEEL, modifier);
    }

    function listenMouseButtonDownUp(aggregator, modifier, type) {
        var key = getKey(type, modifier);

        var isDown = aggregator._isDown;
        var eventStartPosition = aggregator._eventStartPosition;
        var pressTime = aggregator._pressTime;
        var releaseTime = aggregator._releaseTime;

        isDown[key] = false;
        eventStartPosition[key] = new Cartesian2();

        var lastMovement = aggregator._lastMovement[key];
        if (!defined(lastMovement)) {
            lastMovement = aggregator._lastMovement[key] = {
                startPosition : new Cartesian2(),
                endPosition : new Cartesian2(),
                valid : false
            };
        }

        var down;
        var up;
        if (type === CameraEventType.LEFT_DRAG) {
            down = ScreenSpaceEventType.LEFT_DOWN;
            up = ScreenSpaceEventType.LEFT_UP;
        } else if (type === CameraEventType.RIGHT_DRAG) {
            down = ScreenSpaceEventType.RIGHT_DOWN;
            up = ScreenSpaceEventType.RIGHT_UP;
        } else if (type === CameraEventType.MIDDLE_DRAG) {
            down = ScreenSpaceEventType.MIDDLE_DOWN;
            up = ScreenSpaceEventType.MIDDLE_UP;
        }

        aggregator._eventHandler.setInputAction(function(event) {
            aggregator._buttonsDown++;
            lastMovement.valid = false;
            isDown[key] = true;
            pressTime[key] = new Date();
            Cartesian2.clone(event.position, eventStartPosition[key]);
        }, down, modifier);

        aggregator._eventHandler.setInputAction(function() {
            aggregator._buttonsDown = Math.max(aggregator._buttonsDown - 1, 0);
            isDown[key] = false;
            releaseTime[key] = new Date();
        }, up, modifier);
    }

    function cloneMouseMovement(mouseMovement, result) {
        Cartesian2.clone(mouseMovement.startPosition, result.startPosition);
        Cartesian2.clone(mouseMovement.endPosition, result.endPosition);
    }

    function listenMouseMove(aggregator, modifier) {
        var update = aggregator._update;
        var movement = aggregator._movement;
        var lastMovement = aggregator._lastMovement;
        var isDown = aggregator._isDown;

        for ( var typeName in CameraEventType) {
            if (CameraEventType.hasOwnProperty(typeName)) {
                var type = CameraEventType[typeName];
                if (defined(type)) {
                    var key = getKey(type, modifier);
                    update[key] = true;

                    if (!defined(aggregator._lastMovement[key])) {
                        aggregator._lastMovement[key] = {
                            startPosition : new Cartesian2(),
                            endPosition : new Cartesian2(),
                            valid : false
                        };
                    }

                    if (!defined(aggregator._movement[key])) {
                        aggregator._movement[key] = {
                            startPosition : new Cartesian2(),
                            endPosition : new Cartesian2()
                        };
                    }
                }
            }
        }

        aggregator._eventHandler.setInputAction(function(mouseMovement) {
            for ( var typeName in CameraEventType) {
                if (CameraEventType.hasOwnProperty(typeName)) {
                    var type = CameraEventType[typeName];
                    if (defined(type)) {
                        var key = getKey(type, modifier);
                        if (isDown[key]) {
                            if (!update[key]) {
                                Cartesian2.clone(mouseMovement.endPosition, movement[key].endPosition);
                            } else {
                                cloneMouseMovement(movement[key], lastMovement[key]);
                                lastMovement[key].valid = true;
                                cloneMouseMovement(mouseMovement, movement[key]);
                                update[key] = false;
                            }
                        }
                    }
                }
            }

            Cartesian2.clone(mouseMovement.endPosition, aggregator._currentMousePosition);
        }, ScreenSpaceEventType.MOUSE_MOVE, modifier);
    }

    /**
     * Aggregates input events. For example, suppose the following inputs are received between frames:
     * left mouse button down, mouse move, mouse move, left mouse button up. These events will be aggregated into
     * one event with a start and end position of the mouse.
     *
     * @alias CameraEventAggregator
     * @constructor
     *
     * @param {Canvas} [canvas=document] The element to handle events for.
     *
     * @see ScreenSpaceEventHandler
     */
    function CameraEventAggregator(canvas) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(canvas)) {
            throw new DeveloperError('canvas is required.');
        }
        //>>includeEnd('debug');

        this._eventHandler = new ScreenSpaceEventHandler(canvas, true);

        this._update = {};
        this._movement = {};
        this._lastMovement = {};
        this._isDown = {};
        this._eventStartPosition = {};
        this._pressTime = {};
        this._releaseTime = {};

        this._buttonsDown = 0;

        this._currentMousePosition = new Cartesian2();

        listenToWheel(this, undefined);
        listenToPinch(this, undefined, canvas);
        listenMouseButtonDownUp(this, undefined, CameraEventType.LEFT_DRAG);
        listenMouseButtonDownUp(this, undefined, CameraEventType.RIGHT_DRAG);
        listenMouseButtonDownUp(this, undefined, CameraEventType.MIDDLE_DRAG);
        listenMouseMove(this, undefined);

        for ( var modifierName in KeyboardEventModifier) {
            if (KeyboardEventModifier.hasOwnProperty(modifierName)) {
                var modifier = KeyboardEventModifier[modifierName];
                if (defined(modifier)) {
                    listenToWheel(this, modifier);
                    listenToPinch(this, modifier, canvas);
                    listenMouseButtonDownUp(this, modifier, CameraEventType.LEFT_DRAG);
                    listenMouseButtonDownUp(this, modifier, CameraEventType.RIGHT_DRAG);
                    listenMouseButtonDownUp(this, modifier, CameraEventType.MIDDLE_DRAG);
                    listenMouseMove(this, modifier);
                }
            }
        }
    }

    defineProperties(CameraEventAggregator.prototype, {
        /**
         * Gets the current mouse position.
         * @memberof CameraEventAggregator.prototype
         * @type {Cartesian2}
         */
        currentMousePosition : {
            get : function() {
                return this._currentMousePosition;
            }
        },

        /**
         * Gets whether any mouse button is down, a touch has started, or the wheel has been moved.
         * @memberof CameraEventAggregator.prototype
         * @type {Boolean}
         */
        anyButtonDown : {
            get : function() {
                var wheelMoved = !this._update[getKey(CameraEventType.WHEEL)] ||
                                 !this._update[getKey(CameraEventType.WHEEL, KeyboardEventModifier.SHIFT)] ||
                                 !this._update[getKey(CameraEventType.WHEEL, KeyboardEventModifier.CTRL)] ||
                                 !this._update[getKey(CameraEventType.WHEEL, KeyboardEventModifier.ALT)];
                return this._buttonsDown > 0 || wheelMoved;
            }
        }
    });

    /**
     * Gets if a mouse button down or touch has started and has been moved.
     *
     * @param {CameraEventType} type The camera event type.
     * @param {KeyboardEventModifier} [modifier] The keyboard modifier.
     * @returns {Boolean} Returns <code>true</code> if a mouse button down or touch has started and has been moved; otherwise, <code>false</code>
     */
    CameraEventAggregator.prototype.isMoving = function(type, modifier) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(type)) {
            throw new DeveloperError('type is required.');
        }
        //>>includeEnd('debug');

        var key = getKey(type, modifier);
        return !this._update[key];
    };

    /**
     * Gets the aggregated start and end position of the current event.
     *
     * @param {CameraEventType} type The camera event type.
     * @param {KeyboardEventModifier} [modifier] The keyboard modifier.
     * @returns {Object} An object with two {@link Cartesian2} properties: <code>startPosition</code> and <code>endPosition</code>.
     */
    CameraEventAggregator.prototype.getMovement = function(type, modifier) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(type)) {
            throw new DeveloperError('type is required.');
        }
        //>>includeEnd('debug');

        var key = getKey(type, modifier);
        var movement = this._movement[key];
        return movement;
    };

    /**
     * Gets the start and end position of the last move event (not the aggregated event).
     *
     * @param {CameraEventType} type The camera event type.
     * @param {KeyboardEventModifier} [modifier] The keyboard modifier.
     * @returns {Object|undefined} An object with two {@link Cartesian2} properties: <code>startPosition</code> and <code>endPosition</code> or <code>undefined</code>.
     */
    CameraEventAggregator.prototype.getLastMovement = function(type, modifier) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(type)) {
            throw new DeveloperError('type is required.');
        }
        //>>includeEnd('debug');

        var key = getKey(type, modifier);
        var lastMovement = this._lastMovement[key];
        if (lastMovement.valid) {
            return lastMovement;
        }

        return undefined;
    };

    /**
     * Gets whether the mouse button is down or a touch has started.
     *
     * @param {CameraEventType} type The camera event type.
     * @param {KeyboardEventModifier} [modifier] The keyboard modifier.
     * @returns {Boolean} Whether the mouse button is down or a touch has started.
     */
    CameraEventAggregator.prototype.isButtonDown = function(type, modifier) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(type)) {
            throw new DeveloperError('type is required.');
        }
        //>>includeEnd('debug');

        var key = getKey(type, modifier);
        return this._isDown[key];
    };

    /**
     * Gets the mouse position that started the aggregation.
     *
     * @param {CameraEventType} type The camera event type.
     * @param {KeyboardEventModifier} [modifier] The keyboard modifier.
     * @returns {Cartesian2} The mouse position.
     */
    CameraEventAggregator.prototype.getStartMousePosition = function(type, modifier) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(type)) {
            throw new DeveloperError('type is required.');
        }
        //>>includeEnd('debug');

        if (type === CameraEventType.WHEEL) {
            return this._currentMousePosition;
        }

        var key = getKey(type, modifier);
        return this._eventStartPosition[key];
    };

    /**
     * Gets the time the button was pressed or the touch was started.
     *
     * @param {CameraEventType} type The camera event type.
     * @param {KeyboardEventModifier} [modifier] The keyboard modifier.
     * @returns {Date} The time the button was pressed or the touch was started.
     */
    CameraEventAggregator.prototype.getButtonPressTime = function(type, modifier) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(type)) {
            throw new DeveloperError('type is required.');
        }
        //>>includeEnd('debug');

        var key = getKey(type, modifier);
        return this._pressTime[key];
    };

    /**
     * Gets the time the button was released or the touch was ended.
     *
     * @param {CameraEventType} type The camera event type.
     * @param {KeyboardEventModifier} [modifier] The keyboard modifier.
     * @returns {Date} The time the button was released or the touch was ended.
     */
    CameraEventAggregator.prototype.getButtonReleaseTime = function(type, modifier) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(type)) {
            throw new DeveloperError('type is required.');
        }
        //>>includeEnd('debug');

        var key = getKey(type, modifier);
        return this._releaseTime[key];
    };

    /**
     * Signals that all of the events have been handled and the aggregator should be reset to handle new events.
     */
    CameraEventAggregator.prototype.reset = function() {
        for ( var name in this._update) {
            if (this._update.hasOwnProperty(name)) {
                this._update[name] = true;
            }
        }
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see CameraEventAggregator#destroy
     */
    CameraEventAggregator.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Removes mouse listeners held by this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     *
     * @example
     * handler = handler && handler.destroy();
     *
     * @see CameraEventAggregator#isDestroyed
     */
    CameraEventAggregator.prototype.destroy = function() {
        this._eventHandler = this._eventHandler && this._eventHandler.destroy();
        return destroyObject(this);
    };

    //return CameraEventAggregator;
	Cesium.GeoCameraEventAggregator = CameraEventAggregator;
//});
})(window.Cesium);

(function(Cesium){
/*define([
        '../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Core/Cartesian4',
        '../Core/Cartographic',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/Ellipsoid',
        '../Core/HeadingPitchRoll',
        '../Core/IntersectionTests',
        '../Core/isArray',
        '../Core/KeyboardEventModifier',
        '../Core/Math',
        '../Core/Matrix3',
        '../Core/Matrix4',
        '../Core/OrthographicFrustum',
        '../Core/Plane',
        '../Core/Quaternion',
        '../Core/Ray',
        '../Core/Transforms',
        './CameraEventAggregator',
        './CameraEventType',
        './MapMode2D',
        './SceneMode',
        './SceneTransforms',
        './TweenCollection'
    ], function(
        Cartesian2,
        Cartesian3,
        Cartesian4,
        Cartographic,
        defaultValue,
        defined,
        destroyObject,
        DeveloperError,
        Ellipsoid,
        HeadingPitchRoll,
        IntersectionTests,
        isArray,
        KeyboardEventModifier,
        CesiumMath,
        Matrix3,
        Matrix4,
        OrthographicFrustum,
        Plane,
        Quaternion,
        Ray,
        Transforms,
        CameraEventAggregator,
        CameraEventType,
        MapMode2D,
        SceneMode,
        SceneTransforms,
        TweenCollection) {
        */
    'use strict';
	//文件末尾处定义类名
	
	var Cartesian2 = Cesium.Cartesian2;
	var Cartesian3 = Cesium.Cartesian3;
	var Cartesian4 = Cesium.Cartesian4;
	var Cartographic = Cesium.Cartographic;
	var defaultValue = Cesium.defaultValue;
	var defined = Cesium.defined;
	var destroyObject = Cesium.destroyObject;
	var DeveloperError = Cesium.DeveloperError;
	var Ellipsoid = Cesium.Ellipsoid;
	var HeadingPitchRoll = Cesium.HeadingPitchRoll;
	var IntersectionTests = Cesium.IntersectionTests;
	var isArray = Cesium.isArray;
	var KeyboardEventModifier = Cesium.KeyboardEventModifier;
	var CesiumMath = Cesium.Math;
	var Matrix3 = Cesium.Matrix3;
	var Matrix4 = Cesium.Matrix4;
	var OrthographicFrustum = Cesium.OrthographicFrustum;
	var Plane = Cesium.Plane;
	var Quaternion = Cesium.Quaternion;
	var Ray = Cesium.Ray;
	var Transforms = Cesium.Transforms;
	var CameraEventAggregator = Cesium.CameraEventAggregator;
	var CameraEventType = Cesium.CameraEventType;
	var MapMode2D = Cesium.MapMode2D;
	var SceneMode = Cesium.SceneMode;
	var SceneTransforms = Cesium.SceneTransforms;
	var TweenCollection = Cesium.TweenCollection;

    /**
     * Modifies the camera position and orientation based on mouse input to a canvas.
     * @alias ScreenSpaceCameraController
     * @constructor
     *
     * @param {Scene} scene The scene.
     */
    function ScreenSpaceCameraController(scene) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(scene)) {
            throw new DeveloperError('scene is required.');
        }
        //>>includeEnd('debug');

        /**
         * If true, inputs are allowed conditionally with the flags enableTranslate, enableZoom,
         * enableRotate, enableTilt, and enableLook.  If false, all inputs are disabled.
         *
         * NOTE: This setting is for temporary use cases, such as camera flights and
         * drag-selection of regions (see Picking demo).  It is typically set to false at the
         * start of such events, and set true on completion.  To keep inputs disabled
         * past the end of camera flights, you must use the other booleans (enableTranslate,
         * enableZoom, enableRotate, enableTilt, and enableLook).
         * @type {Boolean}
         * @default true
         */
        this.enableInputs = true;
        /**
         * If true, allows the user to pan around the map.  If false, the camera stays locked at the current position.
         * This flag only applies in 2D and Columbus view modes.
         * @type {Boolean}
         * @default true
         */
        this.enableTranslate = true;
        /**
         * If true, allows the user to zoom in and out.  If false, the camera is locked to the current distance from the ellipsoid.
         * @type {Boolean}
         * @default true
         */
        this.enableZoom = true;
        /**
         * If true, allows the user to rotate the camera.  If false, the camera is locked to the current heading.
         * This flag only applies in 2D and 3D.
         * @type {Boolean}
         * @default true
         */
        this.enableRotate = true;
        /**
         * If true, allows the user to tilt the camera.  If false, the camera is locked to the current heading.
         * This flag only applies in 3D and Columbus view.
         * @type {Boolean}
         * @default true
         */
        this.enableTilt = true;
        /**
         * If true, allows the user to use free-look. If false, the camera view direction can only be changed through translating
         * or rotating. This flag only applies in 3D and Columbus view modes.
         * @type {Boolean}
         * @default true
         */
        this.enableLook = true;
        /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to spin because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.9
         */
        this.inertiaSpin = 0.9;
        /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to translate because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.9
         */
        this.inertiaTranslate = 0.9;
        /**
         * A parameter in the range <code>[0, 1)</code> used to determine how long
         * the camera will continue to zoom because of inertia.
         * With value of zero, the camera will have no inertia.
         * @type {Number}
         * @default 0.8
         */
        this.inertiaZoom = 0.8;
        /**
         * A parameter in the range <code>[0, 1)</code> used to limit the range
         * of various user inputs to a percentage of the window width/height per animation frame.
         * This helps keep the camera under control in low-frame-rate situations.
         * @type {Number}
         * @default 0.1
         */
        this.maximumMovementRatio = 0.1;
        /**
         * Sets the duration, in seconds, of the bounce back animations in 2D and Columbus view.
         * @type {Number}
         * @default 3.0
         */
        this.bounceAnimationTime = 3.0;
        /**
         * The minimum magnitude, in meters, of the camera position when zooming. Defaults to 1.0.
         * @type {Number}
         * @default 1.0
         */
        this.minimumZoomDistance = 1.0;
        /**
         * The maximum magnitude, in meters, of the camera position when zooming. Defaults to positive infinity.
         * @type {Number}
         * @default {@link Number.POSITIVE_INFINITY}
         */
        this.maximumZoomDistance = Number.POSITIVE_INFINITY;
        /**
         * The input that allows the user to pan around the map. This only applies in 2D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default {@link CameraEventType.LEFT_DRAG}
         */
        this.translateEventTypes = CameraEventType.LEFT_DRAG;
        /**
         * The input that allows the user to zoom in/out.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default [{@link CameraEventType.RIGHT_DRAG}, {@link CameraEventType.WHEEL}, {@link CameraEventType.PINCH}]
         */
        //this.zoomEventTypes = [CameraEventType.RIGHT_DRAG, CameraEventType.WHEEL, CameraEventType.PINCH];
		//zhangli2018
        this.zoomEventTypes = [CameraEventType.WHEEL, CameraEventType.PINCH];
        /**
         * The input that allows the user to rotate around the globe or another object. This only applies in 3D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default {@link CameraEventType.LEFT_DRAG}
         */
        this.rotateEventTypes = CameraEventType.LEFT_DRAG;
        /**
         * The input that allows the user to tilt in 3D and Columbus view or twist in 2D.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default [{@link CameraEventType.MIDDLE_DRAG}, {@link CameraEventType.PINCH}, {
         *     eventType : {@link CameraEventType.LEFT_DRAG},
         *     modifier : {@link KeyboardEventModifier.CTRL}
         * }, {
         *     eventType : {@link CameraEventType.RIGHT_DRAG},
         *     modifier : {@link KeyboardEventModifier.CTRL}
         * }]
         */
		//zhangli2018
        this.tiltEventTypes = [CameraEventType.RIGHT_DRAG,CameraEventType.MIDDLE_DRAG, CameraEventType.PINCH, {
            eventType : CameraEventType.LEFT_DRAG,
            modifier : KeyboardEventModifier.CTRL
        }, {
            eventType : CameraEventType.RIGHT_DRAG,
            modifier : KeyboardEventModifier.CTRL
        }];
		
        //this.tiltEventTypes = [CameraEventType.MIDDLE_DRAG, CameraEventType.PINCH, {
        //    eventType : CameraEventType.LEFT_DRAG,
        //    modifier : KeyboardEventModifier.CTRL
        //}, {
        //    eventType : CameraEventType.RIGHT_DRAG,
        //    modifier : KeyboardEventModifier.CTRL
        //}];
        /**
         * The input that allows the user to change the direction the camera is viewing. This only applies in 3D and Columbus view modes.
         * <p>
         * The type came be a {@link CameraEventType}, <code>undefined</code>, an object with <code>eventType</code>
         * and <code>modifier</code> properties with types <code>CameraEventType</code> and {@link KeyboardEventModifier},
         * or an array of any of the preceding.
         * </p>
         * @type {CameraEventType|Array|undefined}
         * @default { eventType : {@link CameraEventType.LEFT_DRAG}, modifier : {@link KeyboardEventModifier.SHIFT} }
         */
        this.lookEventTypes = {
            eventType : CameraEventType.LEFT_DRAG,
            modifier : KeyboardEventModifier.SHIFT
        };
        /**
         * The minimum height the camera must be before picking the terrain instead of the ellipsoid.
         * @type {Number}
         * @default 150000.0
         */
        this.minimumPickingTerrainHeight = 150000.0;
        this._minimumPickingTerrainHeight = this.minimumPickingTerrainHeight;
        /**
         * The minimum height the camera must be before testing for collision with terrain.
         * @type {Number}
         * @default 10000.0
         */
        this.minimumCollisionTerrainHeight = 15000.0;
        this._minimumCollisionTerrainHeight = this.minimumCollisionTerrainHeight;
        /**
         * The minimum height the camera must be before switching from rotating a track ball to
         * free look when clicks originate on the sky on in space.
         * @type {Number}
         * @default 7500000.0
         */
        //this.minimumTrackBallHeight = 7500000.0;
		//zhangli2018
        this.minimumTrackBallHeight = -7500000.0;
        this._minimumTrackBallHeight = this.minimumTrackBallHeight;
        /**
         * Enables or disables camera collision detection with terrain.
         * @type {Boolean}
         * @default true
         */
        this.enableCollisionDetection = true;

        this._scene = scene;
        this._globe = undefined;
        this._ellipsoid = undefined;

        // sw`~
		if(Cesium.GeoOption && Cesium.GeoOption.GeoCameraEventAggregator){
			this._aggregator = new Cesium.GeoCameraEventAggregator(scene.canvas);
		}else{
			this._aggregator = new CameraEventAggregator(scene.canvas);
		}
		// sw`e

        this._lastInertiaSpinMovement = undefined;
        this._lastInertiaZoomMovement = undefined;
        this._lastInertiaTranslateMovement = undefined;
        this._lastInertiaTiltMovement = undefined;

        this._tweens = new TweenCollection();
        this._tween = undefined;

        this._horizontalRotationAxis = undefined;

        this._tiltCenterMousePosition = new Cartesian2(-1.0, -1.0);
        this._tiltCenter = new Cartesian3();
        this._rotateMousePosition = new Cartesian2(-1.0, -1.0);
        this._rotateStartPosition = new Cartesian3();
        this._strafeStartPosition = new Cartesian3();
        this._zoomMouseStart = new Cartesian2(-1.0, -1.0);
        this._zoomWorldPosition = new Cartesian3();
        this._useZoomWorldPosition = false;
        this._tiltCVOffMap = false;
        this._looking = false;
        this._rotating = false;
        this._strafing = false;
        this._zoomingOnVector = false;
        this._rotatingZoom = false;

        var projection = scene.mapProjection;
        this._maxCoord = projection.project(new Cartographic(Math.PI, CesiumMath.PI_OVER_TWO));

        // Constants, Make any of these public?
        this._zoomFactor = 5.0;
        this._rotateFactor = undefined;
        this._rotateRateRangeAdjustment = undefined;
        this._maximumRotateRate = 1.77;
        this._minimumRotateRate = 1.0 / 5000.0;
        this._minimumZoomRate = 20.0;
        this._maximumZoomRate = 5906376272000.0;  // distance from the Sun to Pluto in meters.
    }

    function decay(time, coefficient) {
        if (time < 0) {
            return 0.0;
        }

        var tau = (1.0 - coefficient) * 25.0;
        return Math.exp(-tau * time);
    }

    function sameMousePosition(movement) {
        return Cartesian2.equalsEpsilon(movement.startPosition, movement.endPosition, CesiumMath.EPSILON14);
    }

    // If the time between mouse down and mouse up is not between
    // these thresholds, the camera will not move with inertia.
    // This value is probably dependent on the browser and/or the
    // hardware. Should be investigated further.
    var inertiaMaxClickTimeThreshold = 0.4;

    function maintainInertia(aggregator, type, modifier, decayCoef, action, object, lastMovementName) {
        var movementState = object[lastMovementName];
        if (!defined(movementState)) {
            movementState = object[lastMovementName] = {
                startPosition : new Cartesian2(),
                endPosition : new Cartesian2(),
                motion : new Cartesian2(),
                active : false
            };
        }

        var ts = aggregator.getButtonPressTime(type, modifier);
        var tr = aggregator.getButtonReleaseTime(type, modifier);

        var threshold = ts && tr && ((tr.getTime() - ts.getTime()) / 1000.0);
        var now = new Date();
        var fromNow = tr && ((now.getTime() - tr.getTime()) / 1000.0);

        if (ts && tr && threshold < inertiaMaxClickTimeThreshold) {
            var d = decay(fromNow, decayCoef);

            if (!movementState.active) {
                var lastMovement = aggregator.getLastMovement(type, modifier);
                if (!defined(lastMovement) || sameMousePosition(lastMovement)) {
                    return;
                }

                movementState.motion.x = (lastMovement.endPosition.x - lastMovement.startPosition.x) * 0.5;
                movementState.motion.y = (lastMovement.endPosition.y - lastMovement.startPosition.y) * 0.5;

                movementState.startPosition = Cartesian2.clone(lastMovement.startPosition, movementState.startPosition);

                movementState.endPosition = Cartesian2.multiplyByScalar(movementState.motion, d, movementState.endPosition);
                movementState.endPosition = Cartesian2.add(movementState.startPosition, movementState.endPosition, movementState.endPosition);

                movementState.active = true;
            } else {
                movementState.startPosition = Cartesian2.clone(movementState.endPosition, movementState.startPosition);

                movementState.endPosition = Cartesian2.multiplyByScalar(movementState.motion, d, movementState.endPosition);
                movementState.endPosition = Cartesian2.add(movementState.startPosition, movementState.endPosition, movementState.endPosition);

                movementState.motion = Cartesian2.clone(Cartesian2.ZERO, movementState.motion);
            }

            // If value from the decreasing exponential function is close to zero,
            // the end coordinates may be NaN.
            if (isNaN(movementState.endPosition.x) || isNaN(movementState.endPosition.y) || Cartesian2.distance(movementState.startPosition, movementState.endPosition) < 0.5) {
                movementState.active = false;
                return;
            }

            if (!aggregator.isButtonDown(type, modifier)) {
                var startPosition = aggregator.getStartMousePosition(type, modifier);
                action(object, startPosition, movementState);
            }
        } else {
            movementState.active = false;
        }
    }

    var scratchEventTypeArray = [];

    function reactToInput(controller, enabled, eventTypes, action, inertiaConstant, inertiaStateName) {
        if (!defined(eventTypes)) {
            return;
        }

        var aggregator = controller._aggregator;

        if (!isArray(eventTypes)) {
            scratchEventTypeArray[0] = eventTypes;
            eventTypes = scratchEventTypeArray;
        }

        var length = eventTypes.length;
        for (var i = 0; i < length; ++i) {
            var eventType = eventTypes[i];
            var type = defined(eventType.eventType) ? eventType.eventType : eventType;
            var modifier = eventType.modifier;

            var movement = aggregator.isMoving(type, modifier) && aggregator.getMovement(type, modifier);
            var startPosition = aggregator.getStartMousePosition(type, modifier);

            if (controller.enableInputs && enabled) {
                if (movement) {
                    action(controller, startPosition, movement);
                } else if (inertiaConstant < 1.0) {
                    maintainInertia(aggregator, type, modifier, inertiaConstant, action, controller, inertiaStateName);
                }
            }
        }
    }

    var scratchZoomPickRay = new Ray();
    var scratchPickCartesian = new Cartesian3();
    var scratchZoomOffset = new Cartesian2();
    var scratchZoomDirection = new Cartesian3();
    var scratchCenterPixel = new Cartesian2();
    var scratchCenterPosition = new Cartesian3();
    var scratchPositionNormal = new Cartesian3();
    var scratchPickNormal = new Cartesian3();
    var scratchZoomAxis = new Cartesian3();
    var scratchCameraPositionNormal = new Cartesian3();

    // Scratch variables used in zooming algorithm
    var scratchTargetNormal = new Cartesian3();
    var scratchCameraPosition = new Cartesian3();
    var scratchCameraUpNormal = new Cartesian3();
    var scratchCameraRightNormal = new Cartesian3();
    var scratchForwardNormal = new Cartesian3();
    var scratchPositionToTarget = new Cartesian3();
    var scratchPositionToTargetNormal = new Cartesian3();
    var scratchPan = new Cartesian3();
    var scratchCenterMovement = new Cartesian3();
    var scratchCenter = new Cartesian3();
    var scratchCartesian = new Cartesian3();
    var scratchCartesianTwo = new Cartesian3();
    var scratchCartesianThree = new Cartesian3();
    var scratchZoomViewOptions = {
      orientation: new HeadingPitchRoll()
    };

    function handleZoom(object, startPosition, movement, zoomFactor, distanceMeasure, unitPositionDotDirection) {
        var percentage = 1.0;
        if (defined(unitPositionDotDirection)) {
            percentage = CesiumMath.clamp(Math.abs(unitPositionDotDirection), 0.25, 1.0);
        }

        // distanceMeasure should be the height above the ellipsoid.
        // The zoomRate slows as it approaches the surface and stops minimumZoomDistance above it.
        var minHeight = object.minimumZoomDistance * percentage;
        var maxHeight = object.maximumZoomDistance;

        var minDistance = distanceMeasure - minHeight;
        var zoomRate = zoomFactor * minDistance;
        zoomRate = CesiumMath.clamp(zoomRate, object._minimumZoomRate, object._maximumZoomRate);

        var diff = movement.endPosition.y - movement.startPosition.y;
        var rangeWindowRatio = diff / object._scene.canvas.clientHeight;
        rangeWindowRatio = Math.min(rangeWindowRatio, object.maximumMovementRatio);
        var distance = zoomRate * rangeWindowRatio;

        if (distance > 0.0 && Math.abs(distanceMeasure - minHeight) < 1.0) {
            return;
        }

        if (distance < 0.0 && Math.abs(distanceMeasure - maxHeight) < 1.0) {
            return;
        }

        if (distanceMeasure - distance < minHeight) {
            distance = distanceMeasure - minHeight - 1.0;
        } else if (distanceMeasure - distance > maxHeight) {
            distance = distanceMeasure - maxHeight;
        }

        var scene = object._scene;
        var camera = scene.camera;
        var mode = scene.mode;

        var orientation = scratchZoomViewOptions.orientation;
        orientation.heading = camera.heading;
        orientation.pitch = camera.pitch;
        orientation.roll = camera.roll;

        if (camera.frustum instanceof OrthographicFrustum) {
            if (Math.abs(distance) > 0.0) {
                camera.zoomIn(distance);
                camera._adjustOrthographicFrustum();
            }
            return;
        }

        var sameStartPosition = Cartesian2.equals(startPosition, object._zoomMouseStart);
        var zoomingOnVector = object._zoomingOnVector;
        var rotatingZoom = object._rotatingZoom;
        var pickedPosition;

        if (!sameStartPosition) {
            object._zoomMouseStart = Cartesian2.clone(startPosition, object._zoomMouseStart);

            if (defined(object._globe)) {
                pickedPosition = mode !== SceneMode.SCENE2D ? pickGlobe(object, startPosition, scratchPickCartesian) : camera.getPickRay(startPosition, scratchZoomPickRay).origin;
            }
            if (defined(pickedPosition)) {
                object._useZoomWorldPosition = true;
                object._zoomWorldPosition = Cartesian3.clone(pickedPosition, object._zoomWorldPosition);
            } else {
                object._useZoomWorldPosition = false;
            }

            zoomingOnVector = object._zoomingOnVector = false;
            rotatingZoom = object._rotatingZoom = false;
        }

        if (!object._useZoomWorldPosition) {
            camera.zoomIn(distance);
            return;
        }

        var zoomOnVector = mode === SceneMode.COLUMBUS_VIEW;

        if (camera.positionCartographic.height < 2000000) {
            rotatingZoom = true;
        }

        if (!sameStartPosition || rotatingZoom) {
            if (mode === SceneMode.SCENE2D) {
                var worldPosition = object._zoomWorldPosition;
                var endPosition = camera.position;

                if (!Cartesian3.equals(worldPosition, endPosition) && camera.positionCartographic.height < object._maxCoord.x * 2.0) {
                    var savedX = camera.position.x;

                    var direction = Cartesian3.subtract(worldPosition, endPosition, scratchZoomDirection);
                    Cartesian3.normalize(direction, direction);

                    var d = Cartesian3.distance(worldPosition, endPosition) * distance / (camera.getMagnitude() * 0.5);
                    camera.move(direction, d * 0.5);

                    if ((camera.position.x < 0.0 && savedX > 0.0) || (camera.position.x > 0.0 && savedX < 0.0)) {
                        pickedPosition = camera.getPickRay(startPosition, scratchZoomPickRay).origin;
                        object._zoomWorldPosition = Cartesian3.clone(pickedPosition, object._zoomWorldPosition);
                    }
                }
            } else if (mode === SceneMode.SCENE3D) {
                var cameraPositionNormal = Cartesian3.normalize(camera.position, scratchCameraPositionNormal);
                if (camera.positionCartographic.height < 3000.0 && Math.abs(Cartesian3.dot(camera.direction, cameraPositionNormal)) < 0.6) {
                    zoomOnVector = true;
                } else {
                    var canvas = scene.canvas;

                    var centerPixel = scratchCenterPixel;
                    centerPixel.x = canvas.clientWidth / 2;
                    centerPixel.y = canvas.clientHeight / 2;
                    var centerPosition = pickGlobe(object, centerPixel, scratchCenterPosition);
                    // If centerPosition is not defined, it means the globe does not cover the center position of screen

                    if (defined(centerPosition) && camera.positionCartographic.height < 1000000) {

                        var cameraPosition = scratchCameraPosition;
                        Cartesian3.clone(camera.position, cameraPosition);
                        var target = object._zoomWorldPosition;

                        var targetNormal = scratchTargetNormal;

                        targetNormal = Cartesian3.normalize(target, targetNormal);

                        if (Cartesian3.dot(targetNormal, cameraPositionNormal) < 0.0) {
                            return;
                        }

                        var center = scratchCenter;
                        var forward = scratchForwardNormal;
                        Cartesian3.clone(camera.direction, forward);
                        Cartesian3.add(cameraPosition, Cartesian3.multiplyByScalar(forward, 1000, scratchCartesian), center);

                        var positionToTarget = scratchPositionToTarget;
                        var positionToTargetNormal = scratchPositionToTargetNormal;
                        Cartesian3.subtract(target, cameraPosition, positionToTarget);

                        Cartesian3.normalize(positionToTarget, positionToTargetNormal);

                        var alphaDot = Cartesian3.dot(cameraPositionNormal, positionToTargetNormal);
                        if (alphaDot >= 0.0) {
                            // We zoomed past the target, and this zoom is not valid anymore.
                            // This line causes the next zoom movement to pick a new starting point.
                            object._zoomMouseStart.x = -1;
                            return;
                        }
                        var alpha = Math.acos(-alphaDot);
                        var cameraDistance = Cartesian3.magnitude( cameraPosition );
                        var targetDistance = Cartesian3.magnitude( target );
                        var remainingDistance = cameraDistance - distance;
                        var positionToTargetDistance = Cartesian3.magnitude(positionToTarget);

                        var gamma = Math.asin( CesiumMath.clamp( positionToTargetDistance / targetDistance * Math.sin(alpha), -1.0, 1.0 ) );
                        var delta = Math.asin( CesiumMath.clamp( remainingDistance / targetDistance * Math.sin(alpha), -1.0, 1.0 ) );
                        var beta = gamma - delta + alpha;

                        var up = scratchCameraUpNormal;
                        Cartesian3.normalize(cameraPosition, up);
                        var right = scratchCameraRightNormal;
                        right = Cartesian3.cross(positionToTargetNormal, up, right);
                        right = Cartesian3.normalize(right, right );

                        Cartesian3.normalize( Cartesian3.cross(up, right, scratchCartesian), forward );

                        // Calculate new position to move to
                        Cartesian3.multiplyByScalar(Cartesian3.normalize(center, scratchCartesian), (Cartesian3.magnitude(center) - distance), center);
                        Cartesian3.normalize(cameraPosition, cameraPosition);
                        Cartesian3.multiplyByScalar(cameraPosition, remainingDistance, cameraPosition);

                        // Pan
                        var pMid = scratchPan;
                        Cartesian3.multiplyByScalar(Cartesian3.add(
                            Cartesian3.multiplyByScalar(up, Math.cos(beta) - 1, scratchCartesianTwo),
                            Cartesian3.multiplyByScalar(forward, Math.sin(beta), scratchCartesianThree),
                            scratchCartesian
                        ), remainingDistance, pMid);
                        Cartesian3.add(cameraPosition, pMid, cameraPosition);

                        Cartesian3.normalize(center, up);
                        Cartesian3.normalize( Cartesian3.cross(up, right, scratchCartesian), forward );

                        var cMid = scratchCenterMovement;
                        Cartesian3.multiplyByScalar(Cartesian3.add(
                            Cartesian3.multiplyByScalar(up, Math.cos(beta) - 1, scratchCartesianTwo),
                            Cartesian3.multiplyByScalar(forward, Math.sin(beta), scratchCartesianThree),
                            scratchCartesian
                        ), Cartesian3.magnitude(center), cMid);
                        Cartesian3.add(center, cMid, center);

                        // Update camera

                        // Set new position
                        Cartesian3.clone(cameraPosition, camera.position);

                        // Set new direction
                        Cartesian3.normalize(Cartesian3.subtract(center, cameraPosition, scratchCartesian), camera.direction);
                        Cartesian3.clone(camera.direction, camera.direction);

                        // Set new right & up vectors
                        Cartesian3.cross(camera.direction, camera.up, camera.right);
                        Cartesian3.cross(camera.right, camera.direction, camera.up);

                        camera.setView(scratchZoomViewOptions);
                        return;
                    }

                    if (defined(centerPosition)) {
                        var positionNormal = Cartesian3.normalize(centerPosition, scratchPositionNormal);
                        var pickedNormal = Cartesian3.normalize(object._zoomWorldPosition, scratchPickNormal);
                        var dotProduct = Cartesian3.dot(pickedNormal, positionNormal);

                        if (dotProduct > 0.0 && dotProduct < 1.0) {
                            var angle = CesiumMath.acosClamped(dotProduct);
                            var axis = Cartesian3.cross(pickedNormal, positionNormal, scratchZoomAxis);

                            var denom = Math.abs(angle) > CesiumMath.toRadians(20.0) ? camera.positionCartographic.height * 0.75 : camera.positionCartographic.height - distance;
                            var scalar = distance / denom;
                            camera.rotate(axis, angle * scalar);
                        }
                    } else {
                        zoomOnVector = true;
                    }
                }
            }

            object._rotatingZoom = !zoomOnVector;
        }

        if ((!sameStartPosition && zoomOnVector) || zoomingOnVector) {
            var ray;
            var zoomMouseStart = SceneTransforms.wgs84ToWindowCoordinates(scene, object._zoomWorldPosition, scratchZoomOffset);
            if (mode !== SceneMode.COLUMBUS_VIEW && Cartesian2.equals(startPosition, object._zoomMouseStart) && defined(zoomMouseStart)) {
                ray = camera.getPickRay(zoomMouseStart, scratchZoomPickRay);
            } else {
                ray = camera.getPickRay(startPosition, scratchZoomPickRay);
            }

            var rayDirection = ray.direction;
            if (mode === SceneMode.COLUMBUS_VIEW) {
                Cartesian3.fromElements(rayDirection.y, rayDirection.z, rayDirection.x, rayDirection);
            }

            camera.move(rayDirection, distance);

            object._zoomingOnVector = true;
        } else {
            camera.zoomIn(distance);
        }

        camera.setView(scratchZoomViewOptions);
    }

    var translate2DStart = new Ray();
    var translate2DEnd = new Ray();
    var scratchTranslateP0 = new Cartesian3();

    function translate2D(controller, startPosition, movement) {
        var scene = controller._scene;
        var camera = scene.camera;
        var start = camera.getPickRay(movement.startPosition, translate2DStart).origin;
        var end = camera.getPickRay(movement.endPosition, translate2DEnd).origin;

        var direction = Cartesian3.subtract(start, end, scratchTranslateP0);
        var distance = Cartesian3.magnitude(direction);

        if (distance > 0.0) {
            Cartesian3.normalize(direction, direction);
            camera.move(direction, distance);
        }
    }

    function zoom2D(controller, startPosition, movement) {
        if (defined(movement.distance)) {
            movement = movement.distance;
        }

        var scene = controller._scene;
        var camera = scene.camera;

        handleZoom(controller, startPosition, movement, controller._zoomFactor, camera.getMagnitude());
    }

    var twist2DStart = new Cartesian2();
    var twist2DEnd = new Cartesian2();

    function twist2D(controller, startPosition, movement) {
        if (defined(movement.angleAndHeight)) {
            singleAxisTwist2D(controller, startPosition, movement.angleAndHeight);
            return;
        }

        var scene = controller._scene;
        var camera = scene.camera;
        var canvas = scene.canvas;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;

        var start = twist2DStart;
        start.x = (2.0 / width) * movement.startPosition.x - 1.0;
        start.y = (2.0 / height) * (height - movement.startPosition.y) - 1.0;
        start = Cartesian2.normalize(start, start);

        var end = twist2DEnd;
        end.x = (2.0 / width) * movement.endPosition.x - 1.0;
        end.y = (2.0 / height) * (height - movement.endPosition.y) - 1.0;
        end = Cartesian2.normalize(end, end);

        var startTheta = CesiumMath.acosClamped(start.x);
        if (start.y < 0) {
            startTheta = CesiumMath.TWO_PI - startTheta;
        }
        var endTheta = CesiumMath.acosClamped(end.x);
        if (end.y < 0) {
            endTheta = CesiumMath.TWO_PI - endTheta;
        }
        var theta = endTheta - startTheta;

        camera.twistRight(theta);
    }

    function singleAxisTwist2D(controller, startPosition, movement) {
        var rotateRate = controller._rotateFactor * controller._rotateRateRangeAdjustment;

        if (rotateRate > controller._maximumRotateRate) {
            rotateRate = controller._maximumRotateRate;
        }

        if (rotateRate < controller._minimumRotateRate) {
            rotateRate = controller._minimumRotateRate;
        }

        var scene = controller._scene;
        var camera = scene.camera;
        var canvas = scene.canvas;

        var phiWindowRatio = (movement.endPosition.x - movement.startPosition.x) / canvas.clientWidth;
        phiWindowRatio = Math.min(phiWindowRatio, controller.maximumMovementRatio);

        var deltaPhi = rotateRate * phiWindowRatio * Math.PI * 4.0;

        camera.twistRight(deltaPhi);
    }

    function update2D(controller) {
        var rotatable2D = controller._scene.mapMode2D === MapMode2D.ROTATE;
        if (!Matrix4.equals(Matrix4.IDENTITY, controller._scene.camera.transform)) {
            reactToInput(controller, controller.enableZoom, controller.zoomEventTypes, zoom2D, controller.inertiaZoom, '_lastInertiaZoomMovement');
            if (rotatable2D) {
                reactToInput(controller, controller.enableRotate, controller.translateEventTypes, twist2D, controller.inertiaSpin, '_lastInertiaSpinMovement');
            }
        } else {
            reactToInput(controller, controller.enableTranslate, controller.translateEventTypes, translate2D, controller.inertiaTranslate, '_lastInertiaTranslateMovement');
            reactToInput(controller, controller.enableZoom, controller.zoomEventTypes, zoom2D, controller.inertiaZoom, '_lastInertiaZoomMovement');
            if (rotatable2D) {
                reactToInput(controller, controller.enableRotate, controller.tiltEventTypes, twist2D, controller.inertiaSpin, '_lastInertiaTiltMovement');
            }
        }
    }

    var pickGlobeScratchRay = new Ray();
    var scratchDepthIntersection = new Cartesian3();
    var scratchRayIntersection = new Cartesian3();

    function pickGlobe(controller, mousePosition, result) {
        var scene = controller._scene;
        var globe = controller._globe;
        var camera = scene.camera;

        if (!defined(globe)) {
            return undefined;
        }

        var depthIntersection;
        if (scene.pickPositionSupported) {
            depthIntersection = scene.pickPositionWorldCoordinates(mousePosition, scratchDepthIntersection);
        }

        var ray = camera.getPickRay(mousePosition, pickGlobeScratchRay);
        var rayIntersection = globe.pick(ray, scene, scratchRayIntersection);

        var pickDistance = defined(depthIntersection) ? Cartesian3.distance(depthIntersection, camera.positionWC) : Number.POSITIVE_INFINITY;
        var rayDistance = defined(rayIntersection) ? Cartesian3.distance(rayIntersection, camera.positionWC) : Number.POSITIVE_INFINITY;

        if (pickDistance < rayDistance) {
            return Cartesian3.clone(depthIntersection, result);
        }

        return Cartesian3.clone(rayIntersection, result);
    }

    var translateCVStartRay = new Ray();
    var translateCVEndRay = new Ray();
    var translateCVStartPos = new Cartesian3();
    var translateCVEndPos = new Cartesian3();
    var translatCVDifference = new Cartesian3();
    var translateCVOrigin = new Cartesian3();
    var translateCVPlane = new Plane(Cartesian3.UNIT_X, 0.0);
    var translateCVStartMouse = new Cartesian2();
    var translateCVEndMouse = new Cartesian2();

    function translateCV(controller, startPosition, movement) {
        if (!Cartesian3.equals(startPosition, controller._translateMousePosition)) {
            controller._looking = false;
        }

        if (!Cartesian3.equals(startPosition, controller._strafeMousePosition)) {
            controller._strafing = false;
        }

        if (controller._looking) {
            look3D(controller, startPosition, movement);
            return;
        }

        if (controller._strafing) {
            strafe(controller, startPosition, movement);
            return;
        }

        var scene = controller._scene;
        var camera = scene.camera;
        var startMouse = Cartesian2.clone(movement.startPosition, translateCVStartMouse);
        var endMouse = Cartesian2.clone(movement.endPosition, translateCVEndMouse);
        var startRay = camera.getPickRay(startMouse, translateCVStartRay);

        var origin = Cartesian3.clone(Cartesian3.ZERO, translateCVOrigin);
        var normal = Cartesian3.UNIT_X;

        var globePos;
        if (camera.position.z < controller._minimumPickingTerrainHeight) {
            globePos = pickGlobe(controller, startMouse, translateCVStartPos);
            if (defined(globePos)) {
                origin.x = globePos.x;
            }
        }

        if (origin.x > camera.position.z && defined(globePos)) {
            Cartesian3.clone(globePos, controller._strafeStartPosition);
            controller._strafing = true;
            strafe(controller, startPosition, movement);
            controller._strafeMousePosition = Cartesian2.clone(startPosition, controller._strafeMousePosition);
            return;
        }

        var plane = Plane.fromPointNormal(origin, normal, translateCVPlane);

        startRay = camera.getPickRay(startMouse, translateCVStartRay);
        var startPlanePos = IntersectionTests.rayPlane(startRay, plane, translateCVStartPos);

        var endRay = camera.getPickRay(endMouse, translateCVEndRay);
        var endPlanePos = IntersectionTests.rayPlane(endRay, plane, translateCVEndPos);

        if (!defined(startPlanePos) || !defined(endPlanePos)) {
            controller._looking = true;
            look3D(controller, startPosition, movement);
            Cartesian2.clone(startPosition, controller._translateMousePosition);
            return;
        }

        var diff = Cartesian3.subtract(startPlanePos, endPlanePos, translatCVDifference);
        var temp = diff.x;
        diff.x = diff.y;
        diff.y = diff.z;
        diff.z = temp;
        var mag = Cartesian3.magnitude(diff);
        if (mag > CesiumMath.EPSILON6) {
            Cartesian3.normalize(diff, diff);
            camera.move(diff, mag);
        }
    }

    var rotateCVWindowPos = new Cartesian2();
    var rotateCVWindowRay = new Ray();
    var rotateCVCenter = new Cartesian3();
    var rotateCVVerticalCenter = new Cartesian3();
    var rotateCVTransform = new Matrix4();
    var rotateCVVerticalTransform = new Matrix4();
    var rotateCVOrigin = new Cartesian3();
    var rotateCVPlane = new Plane(Cartesian3.UNIT_X, 0.0);
    var rotateCVCartesian3 = new Cartesian3();
    var rotateCVCart = new Cartographic();
    var rotateCVOldTransform = new Matrix4();
    var rotateCVQuaternion = new Quaternion();
    var rotateCVMatrix = new Matrix3();
    var tilt3DCartesian3 = new Cartesian3();

    function rotateCV(controller, startPosition, movement) {
        if (defined(movement.angleAndHeight)) {
            movement = movement.angleAndHeight;
        }

        if (!Cartesian2.equals(startPosition, controller._tiltCenterMousePosition)) {
            controller._tiltCVOffMap = false;
            controller._looking = false;
        }

        if (controller._looking) {
            look3D(controller, startPosition, movement);
            return;
        }

        var scene = controller._scene;
        var camera = scene.camera;
        var maxCoord = controller._maxCoord;
        var onMap = Math.abs(camera.position.x) - maxCoord.x < 0 && Math.abs(camera.position.y) - maxCoord.y < 0;

        if (controller._tiltCVOffMap || !onMap || camera.position.z > controller._minimumPickingTerrainHeight) {
            controller._tiltCVOffMap = true;
            rotateCVOnPlane(controller, startPosition, movement);
        } else {
            rotateCVOnTerrain(controller, startPosition, movement);
        }
    }

    function rotateCVOnPlane(controller, startPosition, movement) {
        var scene = controller._scene;
        var camera = scene.camera;
        var canvas = scene.canvas;

        var windowPosition = rotateCVWindowPos;
        windowPosition.x = canvas.clientWidth / 2;
        windowPosition.y = canvas.clientHeight / 2;
        var ray = camera.getPickRay(windowPosition, rotateCVWindowRay);
        var normal = Cartesian3.UNIT_X;

        var position = ray.origin;
        var direction = ray.direction;
        var scalar;
        var normalDotDirection = Cartesian3.dot(normal, direction);
        if (Math.abs(normalDotDirection) > CesiumMath.EPSILON6) {
            scalar = -Cartesian3.dot(normal, position) / normalDotDirection;
        }

        if (!defined(scalar) || scalar <= 0.0) {
            controller._looking = true;
            look3D(controller, startPosition, movement);
            Cartesian2.clone(startPosition, controller._tiltCenterMousePosition);
            return;
        }

        var center = Cartesian3.multiplyByScalar(direction, scalar, rotateCVCenter);
        Cartesian3.add(position, center, center);

        var projection = scene.mapProjection;
        var ellipsoid = projection.ellipsoid;

        Cartesian3.fromElements(center.y, center.z, center.x, center);
        var cart = projection.unproject(center, rotateCVCart);
        ellipsoid.cartographicToCartesian(cart, center);

        var transform = Transforms.eastNorthUpToFixedFrame(center, ellipsoid, rotateCVTransform);

        var oldGlobe = controller._globe;
        var oldEllipsoid = controller._ellipsoid;
        controller._globe = undefined;
        controller._ellipsoid = Ellipsoid.UNIT_SPHERE;
        controller._rotateFactor = 1.0;
        controller._rotateRateRangeAdjustment = 1.0;

        var oldTransform = Matrix4.clone(camera.transform, rotateCVOldTransform);
        camera._setTransform(transform);

        rotate3D(controller, startPosition, movement, Cartesian3.UNIT_Z);

        camera._setTransform(oldTransform);
        controller._globe = oldGlobe;
        controller._ellipsoid = oldEllipsoid;

        var radius = oldEllipsoid.maximumRadius;
        controller._rotateFactor = 1.0 / radius;
        controller._rotateRateRangeAdjustment = radius;
    }

    function rotateCVOnTerrain(controller, startPosition, movement) {
        var scene = controller._scene;
        var camera = scene.camera;

        var center;
        var ray;
        var normal = Cartesian3.UNIT_X;

        if (Cartesian2.equals(startPosition, controller._tiltCenterMousePosition)) {
            center = Cartesian3.clone(controller._tiltCenter, rotateCVCenter);
        } else {
            if (camera.position.z < controller._minimumPickingTerrainHeight) {
                center = pickGlobe(controller, startPosition, rotateCVCenter);
            }

            if (!defined(center)) {
                ray = camera.getPickRay(startPosition, rotateCVWindowRay);
                var position = ray.origin;
                var direction = ray.direction;

                var scalar;
                var normalDotDirection = Cartesian3.dot(normal, direction);
                if (Math.abs(normalDotDirection) > CesiumMath.EPSILON6) {
                    scalar = -Cartesian3.dot(normal, position) / normalDotDirection;
                }

                if (!defined(scalar) || scalar <= 0.0) {
                    controller._looking = true;
                    look3D(controller, startPosition, movement);
                    Cartesian2.clone(startPosition, controller._tiltCenterMousePosition);
                    return;
                }

                center = Cartesian3.multiplyByScalar(direction, scalar, rotateCVCenter);
                Cartesian3.add(position, center, center);
            }

            Cartesian2.clone(startPosition, controller._tiltCenterMousePosition);
            Cartesian3.clone(center, controller._tiltCenter);
        }

        var canvas = scene.canvas;

        var windowPosition = rotateCVWindowPos;
        windowPosition.x = canvas.clientWidth / 2;
        windowPosition.y = controller._tiltCenterMousePosition.y;
        ray = camera.getPickRay(windowPosition, rotateCVWindowRay);

        var origin = Cartesian3.clone(Cartesian3.ZERO, rotateCVOrigin);
        origin.x = center.x;

        var plane = Plane.fromPointNormal(origin, normal, rotateCVPlane);
        var verticalCenter = IntersectionTests.rayPlane(ray, plane, rotateCVVerticalCenter);

        var projection = camera._projection;
        var ellipsoid = projection.ellipsoid;

        Cartesian3.fromElements(center.y, center.z, center.x, center);
        var cart = projection.unproject(center, rotateCVCart);
        ellipsoid.cartographicToCartesian(cart, center);

        var transform = Transforms.eastNorthUpToFixedFrame(center, ellipsoid, rotateCVTransform);

        var verticalTransform;
        if (defined(verticalCenter)) {
            Cartesian3.fromElements(verticalCenter.y, verticalCenter.z, verticalCenter.x, verticalCenter);
            cart = projection.unproject(verticalCenter, rotateCVCart);
            ellipsoid.cartographicToCartesian(cart, verticalCenter);

            verticalTransform = Transforms.eastNorthUpToFixedFrame(verticalCenter, ellipsoid, rotateCVVerticalTransform);
        } else {
            verticalTransform = transform;
        }

        var oldGlobe = controller._globe;
        var oldEllipsoid = controller._ellipsoid;
        controller._globe = undefined;
        controller._ellipsoid = Ellipsoid.UNIT_SPHERE;
        controller._rotateFactor = 1.0;
        controller._rotateRateRangeAdjustment = 1.0;

        var constrainedAxis = Cartesian3.UNIT_Z;

        var oldTransform = Matrix4.clone(camera.transform, rotateCVOldTransform);
        camera._setTransform(transform);

        var tangent = Cartesian3.cross(Cartesian3.UNIT_Z, Cartesian3.normalize(camera.position, rotateCVCartesian3), rotateCVCartesian3);
        var dot = Cartesian3.dot(camera.right, tangent);

        rotate3D(controller, startPosition, movement, constrainedAxis, false, true);

        camera._setTransform(verticalTransform);
        if (dot < 0.0) {
            if (movement.startPosition.y > movement.endPosition.y) {
                constrainedAxis = undefined;
            }

            var oldConstrainedAxis = camera.constrainedAxis;
            camera.constrainedAxis = undefined;

            rotate3D(controller, startPosition, movement, constrainedAxis, true, false);

            camera.constrainedAxis = oldConstrainedAxis;
        } else {
            rotate3D(controller, startPosition, movement, constrainedAxis, true, false);
        }

        if (defined(camera.constrainedAxis)) {
            var right = Cartesian3.cross(camera.direction, camera.constrainedAxis, tilt3DCartesian3);
            if (!Cartesian3.equalsEpsilon(right, Cartesian3.ZERO, CesiumMath.EPSILON6)) {
                if (Cartesian3.dot(right, camera.right) < 0.0) {
                    Cartesian3.negate(right, right);
                }

                Cartesian3.cross(right, camera.direction, camera.up);
                Cartesian3.cross(camera.direction, camera.up, camera.right);

                Cartesian3.normalize(camera.up, camera.up);
                Cartesian3.normalize(camera.right, camera.right);
            }
        }

        camera._setTransform(oldTransform);
        controller._globe = oldGlobe;
        controller._ellipsoid = oldEllipsoid;

        var radius = oldEllipsoid.maximumRadius;
        controller._rotateFactor = 1.0 / radius;
        controller._rotateRateRangeAdjustment = radius;

        var originalPosition = Cartesian3.clone(camera.positionWC, rotateCVCartesian3);
        camera._adjustHeightForTerrain();

        if (!Cartesian3.equals(camera.positionWC, originalPosition)) {
            camera._setTransform(verticalTransform);
            camera.worldToCameraCoordinatesPoint(originalPosition, originalPosition);

            var magSqrd = Cartesian3.magnitudeSquared(originalPosition);
            if (Cartesian3.magnitudeSquared(camera.position) > magSqrd) {
                Cartesian3.normalize(camera.position, camera.position);
                Cartesian3.multiplyByScalar(camera.position, Math.sqrt(magSqrd), camera.position);
            }

            var angle = Cartesian3.angleBetween(originalPosition, camera.position);
            var axis = Cartesian3.cross(originalPosition, camera.position, originalPosition);
            Cartesian3.normalize(axis, axis);

            var quaternion = Quaternion.fromAxisAngle(axis, angle, rotateCVQuaternion);
            var rotation = Matrix3.fromQuaternion(quaternion, rotateCVMatrix);
            Matrix3.multiplyByVector(rotation, camera.direction, camera.direction);
            Matrix3.multiplyByVector(rotation, camera.up, camera.up);
            Cartesian3.cross(camera.direction, camera.up, camera.right);
            Cartesian3.cross(camera.right, camera.direction, camera.up);

            camera._setTransform(oldTransform);
        }
    }

    var zoomCVWindowPos = new Cartesian2();
    var zoomCVWindowRay = new Ray();
    var zoomCVIntersection = new Cartesian3();

    function zoomCV(controller, startPosition, movement) {
        if (defined(movement.distance)) {
            movement = movement.distance;
        }

        var scene = controller._scene;
        var camera = scene.camera;
        var canvas = scene.canvas;

        var windowPosition = zoomCVWindowPos;
        windowPosition.x = canvas.clientWidth / 2;
        windowPosition.y = canvas.clientHeight / 2;
        var ray = camera.getPickRay(windowPosition, zoomCVWindowRay);

        var intersection;
        if (camera.position.z < controller._minimumPickingTerrainHeight) {
            intersection = pickGlobe(controller, windowPosition, zoomCVIntersection);
        }

        var distance;
        if (defined(intersection)) {
            distance = Cartesian3.distance(ray.origin, intersection);
        } else {
            var normal = Cartesian3.UNIT_X;
            var position = ray.origin;
            var direction = ray.direction;
            distance = -Cartesian3.dot(normal, position) / Cartesian3.dot(normal, direction);
        }

        handleZoom(controller, startPosition, movement, controller._zoomFactor, distance);
    }

    function updateCV(controller) {
        var scene = controller._scene;
        var camera = scene.camera;

        if (!Matrix4.equals(Matrix4.IDENTITY, camera.transform)) {
            reactToInput(controller, controller.enableRotate, controller.rotateEventTypes, rotate3D, controller.inertiaSpin, '_lastInertiaSpinMovement');
            reactToInput(controller, controller.enableZoom, controller.zoomEventTypes, zoom3D, controller.inertiaZoom, '_lastInertiaZoomMovement');
        } else {
            var tweens = controller._tweens;

            if (controller._aggregator.anyButtonDown) {
                tweens.removeAll();
            }

            reactToInput(controller, controller.enableTilt, controller.tiltEventTypes, rotateCV, controller.inertiaSpin, '_lastInertiaTiltMovement');
            reactToInput(controller, controller.enableTranslate, controller.translateEventTypes, translateCV, controller.inertiaTranslate, '_lastInertiaTranslateMovement');
            reactToInput(controller, controller.enableZoom, controller.zoomEventTypes, zoomCV, controller.inertiaZoom, '_lastInertiaZoomMovement');
            reactToInput(controller, controller.enableLook, controller.lookEventTypes, look3D);

            if (!controller._aggregator.anyButtonDown &&
                    (!defined(controller._lastInertiaZoomMovement) || !controller._lastInertiaZoomMovement.active) &&
                    (!defined(controller._lastInertiaTranslateMovement) || !controller._lastInertiaTranslateMovement.active) &&
                    !tweens.contains(controller._tween)) {
                var tween = camera.createCorrectPositionTween(controller.bounceAnimationTime);
                if (defined(tween)) {
                    controller._tween = tweens.add(tween);
                }
            }

            tweens.update();
        }
    }

    var scratchStrafeRay = new Ray();
    var scratchStrafePlane = new Plane(Cartesian3.UNIT_X, 0.0);
    var scratchStrafeIntersection = new Cartesian3();
    var scratchStrafeDirection = new Cartesian3();
    var scratchMousePos = new Cartesian3();

    function strafe(controller, startPosition, movement) {
        var scene = controller._scene;
        var camera = scene.camera;

        var mouseStartPosition = pickGlobe(controller, movement.startPosition, scratchMousePos);
        if (!defined(mouseStartPosition)) {
            return;
        }

        var mousePosition = movement.endPosition;
        var ray = camera.getPickRay(mousePosition, scratchStrafeRay);

        var direction = Cartesian3.clone(camera.direction, scratchStrafeDirection);
        if (scene.mode === SceneMode.COLUMBUS_VIEW) {
            Cartesian3.fromElements(direction.z, direction.x, direction.y, direction);
        }

        var plane = Plane.fromPointNormal(mouseStartPosition, direction, scratchStrafePlane);
        var intersection = IntersectionTests.rayPlane(ray, plane, scratchStrafeIntersection);
        if (!defined(intersection)) {
            return;
        }

        direction = Cartesian3.subtract(mouseStartPosition, intersection, direction);
        if (scene.mode === SceneMode.COLUMBUS_VIEW) {
            Cartesian3.fromElements(direction.y, direction.z, direction.x, direction);
        }

        Cartesian3.add(camera.position, direction, camera.position);
    }

    var spin3DPick = new Cartesian3();
    var scratchCartographic = new Cartographic();
    var scratchRadii = new Cartesian3();
    var scratchEllipsoid = new Ellipsoid();
    var scratchLookUp = new Cartesian3();

    function spin3D(controller, startPosition, movement) {
        var scene = controller._scene;
        var camera = scene.camera;

        if (!Matrix4.equals(camera.transform, Matrix4.IDENTITY)) {
            rotate3D(controller, startPosition, movement);
            return;
        }

        var magnitude;
        var radii;
        var ellipsoid;

        var up = controller._ellipsoid.geodeticSurfaceNormal(camera.position, scratchLookUp);

        var height = controller._ellipsoid.cartesianToCartographic(camera.positionWC, scratchCartographic).height;
        var globe = controller._globe;

        var mousePos;
        var tangentPick = false;
        if (defined(globe) && height < controller._minimumPickingTerrainHeight) {
            mousePos = pickGlobe(controller, movement.startPosition, scratchMousePos);
            if (defined(mousePos)) {
                var ray = camera.getPickRay(movement.startPosition, pickGlobeScratchRay);
                var normal = controller._ellipsoid.geodeticSurfaceNormal(mousePos);
                tangentPick = Math.abs(Cartesian3.dot(ray.direction, normal)) < 0.05;

                if (tangentPick && !controller._looking) {
                    controller._rotating = false;
                    controller._strafing = true;
                }
            }
        }

        if (Cartesian2.equals(startPosition, controller._rotateMousePosition)) {
            if (controller._looking) {
                look3D(controller, startPosition, movement, up);
            } else if (controller._rotating) {
                rotate3D(controller, startPosition, movement);
            } else if (controller._strafing) {
                Cartesian3.clone(mousePos, controller._strafeStartPosition);
                strafe(controller, startPosition, movement);
            } else {
                magnitude = Cartesian3.magnitude(controller._rotateStartPosition);
                radii = scratchRadii;
                radii.x = radii.y = radii.z = magnitude;
                ellipsoid = Ellipsoid.fromCartesian3(radii, scratchEllipsoid);
                pan3D(controller, startPosition, movement, ellipsoid);
            }
            return;
        }
        controller._looking = false;
        controller._rotating = false;
        controller._strafing = false;

        if (defined(globe) && height < controller._minimumPickingTerrainHeight) {
            if (defined(mousePos)) {
                if (Cartesian3.magnitude(camera.position) < Cartesian3.magnitude(mousePos)) {
                    Cartesian3.clone(mousePos, controller._strafeStartPosition);

                    controller._strafing = true;
                    strafe(controller, startPosition, movement);
                } else {
                    magnitude = Cartesian3.magnitude(mousePos);
                    radii = scratchRadii;
                    radii.x = radii.y = radii.z = magnitude;
                    ellipsoid = Ellipsoid.fromCartesian3(radii, scratchEllipsoid);
                    pan3D(controller, startPosition, movement, ellipsoid);

                    Cartesian3.clone(mousePos, controller._rotateStartPosition);
                }
            } else {
                controller._looking = true;
                look3D(controller, startPosition, movement, up);
            }
        } else if (defined(camera.pickEllipsoid(movement.startPosition, controller._ellipsoid, spin3DPick))) {
            pan3D(controller, startPosition, movement, controller._ellipsoid);
            Cartesian3.clone(spin3DPick, controller._rotateStartPosition);
        } else if (height > controller._minimumTrackBallHeight) {
            controller._rotating = true;
            rotate3D(controller, startPosition, movement);
        } else {
            controller._looking = true;
            look3D(controller, startPosition, movement, up);
        }

        Cartesian2.clone(startPosition, controller._rotateMousePosition);
    }

    function rotate3D(controller, startPosition, movement, constrainedAxis, rotateOnlyVertical, rotateOnlyHorizontal) {
        rotateOnlyVertical = defaultValue(rotateOnlyVertical, false);
        rotateOnlyHorizontal = defaultValue(rotateOnlyHorizontal, false);

        var scene = controller._scene;
        var camera = scene.camera;
        var canvas = scene.canvas;

        var oldAxis = camera.constrainedAxis;
        if (defined(constrainedAxis)) {
            camera.constrainedAxis = constrainedAxis;
        }

        var rho = Cartesian3.magnitude(camera.position);
        var rotateRate = controller._rotateFactor * (rho - controller._rotateRateRangeAdjustment);

        if (rotateRate > controller._maximumRotateRate) {
            rotateRate = controller._maximumRotateRate;
        }

        if (rotateRate < controller._minimumRotateRate) {
            rotateRate = controller._minimumRotateRate;
        }

        var phiWindowRatio = (movement.startPosition.x - movement.endPosition.x) / canvas.clientWidth;
        var thetaWindowRatio = (movement.startPosition.y - movement.endPosition.y) / canvas.clientHeight;
        phiWindowRatio = Math.min(phiWindowRatio, controller.maximumMovementRatio);
        thetaWindowRatio = Math.min(thetaWindowRatio, controller.maximumMovementRatio);

        var deltaPhi = rotateRate * phiWindowRatio * Math.PI * 2.0;
        var deltaTheta = rotateRate * thetaWindowRatio * Math.PI;

        if (!rotateOnlyVertical) {
            camera.rotateRight(deltaPhi);
        }

        if (!rotateOnlyHorizontal) {
            camera.rotateUp(deltaTheta);
        }

        camera.constrainedAxis = oldAxis;
    }

    var pan3DP0 = Cartesian4.clone(Cartesian4.UNIT_W);
    var pan3DP1 = Cartesian4.clone(Cartesian4.UNIT_W);
    var pan3DTemp0 = new Cartesian3();
    var pan3DTemp1 = new Cartesian3();
    var pan3DTemp2 = new Cartesian3();
    var pan3DTemp3 = new Cartesian3();
    var pan3DStartMousePosition = new Cartesian2();
    var pan3DEndMousePosition = new Cartesian2();

    function pan3D(controller, startPosition, movement, ellipsoid) {
        var scene = controller._scene;
        var camera = scene.camera;

        var startMousePosition = Cartesian2.clone(movement.startPosition, pan3DStartMousePosition);
        var endMousePosition = Cartesian2.clone(movement.endPosition, pan3DEndMousePosition);

        var p0 = camera.pickEllipsoid(startMousePosition, ellipsoid, pan3DP0);
        var p1 = camera.pickEllipsoid(endMousePosition, ellipsoid, pan3DP1);

        if (!defined(p0) || !defined(p1)) {
            controller._rotating = true;
            rotate3D(controller, startPosition, movement);
            return;
        }

        p0 = camera.worldToCameraCoordinates(p0, p0);
        p1 = camera.worldToCameraCoordinates(p1, p1);

        if (!defined(camera.constrainedAxis)) {
            Cartesian3.normalize(p0, p0);
            Cartesian3.normalize(p1, p1);
            var dot = Cartesian3.dot(p0, p1);
            var axis = Cartesian3.cross(p0, p1, pan3DTemp0);

            if (dot < 1.0 && !Cartesian3.equalsEpsilon(axis, Cartesian3.ZERO, CesiumMath.EPSILON14)) { // dot is in [0, 1]
                var angle = Math.acos(dot);
                camera.rotate(axis, angle);
            }
        } else {
            var basis0 = camera.constrainedAxis;
            var basis1 = Cartesian3.mostOrthogonalAxis(basis0, pan3DTemp0);
            Cartesian3.cross(basis1, basis0, basis1);
            Cartesian3.normalize(basis1, basis1);
            var basis2 = Cartesian3.cross(basis0, basis1, pan3DTemp1);

            var startRho = Cartesian3.magnitude(p0);
            var startDot = Cartesian3.dot(basis0, p0);
            var startTheta = Math.acos(startDot / startRho);
            var startRej = Cartesian3.multiplyByScalar(basis0, startDot, pan3DTemp2);
            Cartesian3.subtract(p0, startRej, startRej);
            Cartesian3.normalize(startRej, startRej);

            var endRho = Cartesian3.magnitude(p1);
            var endDot = Cartesian3.dot(basis0, p1);
            var endTheta = Math.acos(endDot / endRho);
            var endRej = Cartesian3.multiplyByScalar(basis0, endDot, pan3DTemp3);
            Cartesian3.subtract(p1, endRej, endRej);
            Cartesian3.normalize(endRej, endRej);

            var startPhi = Math.acos(Cartesian3.dot(startRej, basis1));
            if (Cartesian3.dot(startRej, basis2) < 0) {
                startPhi = CesiumMath.TWO_PI - startPhi;
            }

            var endPhi = Math.acos(Cartesian3.dot(endRej, basis1));
            if (Cartesian3.dot(endRej, basis2) < 0) {
                endPhi = CesiumMath.TWO_PI - endPhi;
            }

            var deltaPhi = startPhi - endPhi;

            var east;
            if (Cartesian3.equalsEpsilon(basis0, camera.position, CesiumMath.EPSILON2)) {
                east = camera.right;
            } else {
                east = Cartesian3.cross(basis0, camera.position, pan3DTemp0);
            }

            var planeNormal = Cartesian3.cross(basis0, east, pan3DTemp0);
            var side0 = Cartesian3.dot(planeNormal, Cartesian3.subtract(p0, basis0, pan3DTemp1));
            var side1 = Cartesian3.dot(planeNormal, Cartesian3.subtract(p1, basis0, pan3DTemp1));

            var deltaTheta;
            if (side0 > 0 && side1 > 0) {
                deltaTheta = endTheta - startTheta;
            } else if (side0 > 0 && side1 <= 0) {
                if (Cartesian3.dot(camera.position, basis0) > 0) {
                    deltaTheta = -startTheta - endTheta;
                } else {
                    deltaTheta = startTheta + endTheta;
                }
            } else {
                deltaTheta = startTheta - endTheta;
            }

            camera.rotateRight(deltaPhi);
            camera.rotateUp(deltaTheta);
        }
    }

    var zoom3DUnitPosition = new Cartesian3();
    var zoom3DCartographic = new Cartographic();

    function zoom3D(controller, startPosition, movement) {
        if (defined(movement.distance)) {
            movement = movement.distance;
        }

        var ellipsoid = controller._ellipsoid;
        var scene = controller._scene;
        var camera = scene.camera;
        var canvas = scene.canvas;

        var windowPosition = zoomCVWindowPos;
        windowPosition.x = canvas.clientWidth / 2;
        windowPosition.y = canvas.clientHeight / 2;
        var ray = camera.getPickRay(windowPosition, zoomCVWindowRay);

        var intersection;
        var height = ellipsoid.cartesianToCartographic(camera.position, zoom3DCartographic).height;
        if (height < controller._minimumPickingTerrainHeight) {
            intersection = pickGlobe(controller, windowPosition, zoomCVIntersection);
        }

        var distance;
        if (defined(intersection)) {
            distance = Cartesian3.distance(ray.origin, intersection);
        } else {
            distance = height;
        }

        var unitPosition = Cartesian3.normalize(camera.position, zoom3DUnitPosition);
        handleZoom(controller, startPosition, movement, controller._zoomFactor, distance, Cartesian3.dot(unitPosition, camera.direction));
    }

    var tilt3DWindowPos = new Cartesian2();
    var tilt3DRay = new Ray();
    var tilt3DCenter = new Cartesian3();
    var tilt3DVerticalCenter = new Cartesian3();
    var tilt3DTransform = new Matrix4();
    var tilt3DVerticalTransform = new Matrix4();
    var tilt3DOldTransform = new Matrix4();
    var tilt3DQuaternion = new Quaternion();
    var tilt3DMatrix = new Matrix3();
    var tilt3DCart = new Cartographic();
    var tilt3DLookUp = new Cartesian3();

    function tilt3D(controller, startPosition, movement) {
        var scene = controller._scene;
        var camera = scene.camera;
		
		if (movement && movement.startPosition && movement.endPosition) {//~!
			//zhangli2018
			startPosition = movement.endPosition;
			movement.endPosition = movement.startPosition;
			movement.startPosition = startPosition;
			//zhangli2018
			movement.endPosition.x = (movement.startPosition.x + movement.endPosition.x) / 2;
			movement.endPosition.y = (movement.startPosition.y + movement.endPosition.y) / 2;
		}

        if (!Matrix4.equals(camera.transform, Matrix4.IDENTITY)) {
            return;
        }

        if (defined(movement.angleAndHeight)) {
            movement = movement.angleAndHeight;
        }

        if (!Cartesian2.equals(startPosition, controller._tiltCenterMousePosition)) {
            controller._tiltOnEllipsoid = false;
            controller._looking = false;
        }

        if (controller._looking) {
            var up = controller._ellipsoid.geodeticSurfaceNormal(camera.position, tilt3DLookUp);
            look3D(controller, startPosition, movement, up);
            return;
        }

        var ellipsoid = controller._ellipsoid;
        var cartographic = ellipsoid.cartesianToCartographic(camera.position, tilt3DCart);

        if (controller._tiltOnEllipsoid || cartographic.height > controller._minimumCollisionTerrainHeight) {
            controller._tiltOnEllipsoid = true;
            tilt3DOnEllipsoid(controller, startPosition, movement);
        } else {
            tilt3DOnTerrain(controller, startPosition, movement);
        }
    }

    var tilt3DOnEllipsoidCartographic = new Cartographic();

    function tilt3DOnEllipsoid(controller, startPosition, movement) {
        var ellipsoid = controller._ellipsoid;
        var scene = controller._scene;
        var camera = scene.camera;
        var minHeight = controller.minimumZoomDistance * 0.25;
        var height = ellipsoid.cartesianToCartographic(camera.positionWC, tilt3DOnEllipsoidCartographic).height;
        if (height - minHeight - 1.0 < CesiumMath.EPSILON3 &&
                movement.endPosition.y - movement.startPosition.y < 0) {
            return;
        }

        var canvas = scene.canvas;

        var windowPosition = tilt3DWindowPos;
        windowPosition.x = canvas.clientWidth / 2;
        windowPosition.y = canvas.clientHeight / 2;
        var ray = camera.getPickRay(windowPosition, tilt3DRay);

        var center;
        var intersection = IntersectionTests.rayEllipsoid(ray, ellipsoid);
        if (defined(intersection)) {
            center = Ray.getPoint(ray, intersection.start, tilt3DCenter);
        } else if (height > controller._minimumTrackBallHeight) {
            var grazingAltitudeLocation = IntersectionTests.grazingAltitudeLocation(ray, ellipsoid);
            if (!defined(grazingAltitudeLocation)) {
                return;
            }
            var grazingAltitudeCart = ellipsoid.cartesianToCartographic(grazingAltitudeLocation, tilt3DCart);
            grazingAltitudeCart.height = 0.0;
            center = ellipsoid.cartographicToCartesian(grazingAltitudeCart, tilt3DCenter);
        } else {
            controller._looking = true;
            var up = controller._ellipsoid.geodeticSurfaceNormal(camera.position, tilt3DLookUp);
            look3D(controller, startPosition, movement, up);
            Cartesian2.clone(startPosition, controller._tiltCenterMousePosition);
            return;
        }

        var transform = Transforms.eastNorthUpToFixedFrame(center, ellipsoid, tilt3DTransform);

        var oldGlobe = controller._globe;
        var oldEllipsoid = controller._ellipsoid;
        controller._globe = undefined;
        controller._ellipsoid = Ellipsoid.UNIT_SPHERE;
        controller._rotateFactor = 1.0;
        controller._rotateRateRangeAdjustment = 1.0;

        var oldTransform = Matrix4.clone(camera.transform, tilt3DOldTransform);
        camera._setTransform(transform);

        rotate3D(controller, startPosition, movement, Cartesian3.UNIT_Z);

        camera._setTransform(oldTransform);
        controller._globe = oldGlobe;
        controller._ellipsoid = oldEllipsoid;

        var radius = oldEllipsoid.maximumRadius;
        controller._rotateFactor = 1.0 / radius;
        controller._rotateRateRangeAdjustment = radius;
    }

    function tilt3DOnTerrain(controller, startPosition, movement) {
        var ellipsoid = controller._ellipsoid;
        var scene = controller._scene;
        var camera = scene.camera;

        var center;
        var ray;
        var intersection;

        if (Cartesian2.equals(startPosition, controller._tiltCenterMousePosition)) {
            center = Cartesian3.clone(controller._tiltCenter, tilt3DCenter);
        } else {
            center = pickGlobe(controller, startPosition, tilt3DCenter);

            if (!defined(center)) {
                ray = camera.getPickRay(startPosition, tilt3DRay);
                intersection = IntersectionTests.rayEllipsoid(ray, ellipsoid);
                if (!defined(intersection)) {
                    var cartographic = ellipsoid.cartesianToCartographic(camera.position, tilt3DCart);
                    if (cartographic.height <= controller._minimumTrackBallHeight) {
                        controller._looking = true;
                        var up = controller._ellipsoid.geodeticSurfaceNormal(camera.position, tilt3DLookUp);
                        look3D(controller, startPosition, movement, up);
                        Cartesian2.clone(startPosition, controller._tiltCenterMousePosition);
                    }
                    return;
                }
                center = Ray.getPoint(ray, intersection.start, tilt3DCenter);
            }

            Cartesian2.clone(startPosition, controller._tiltCenterMousePosition);
            Cartesian3.clone(center, controller._tiltCenter);
        }

        var canvas = scene.canvas;

        var windowPosition = tilt3DWindowPos;
        windowPosition.x = canvas.clientWidth / 2;
        windowPosition.y = controller._tiltCenterMousePosition.y;
        ray = camera.getPickRay(windowPosition, tilt3DRay);

        var mag = Cartesian3.magnitude(center);
        var radii = Cartesian3.fromElements(mag, mag, mag, scratchRadii);
        var newEllipsoid = Ellipsoid.fromCartesian3(radii, scratchEllipsoid);

        intersection = IntersectionTests.rayEllipsoid(ray, newEllipsoid);
        if (!defined(intersection)) {
            return;
        }

        var t = Cartesian3.magnitude(ray.origin) > mag ? intersection.start : intersection.stop;
        var verticalCenter = Ray.getPoint(ray, t, tilt3DVerticalCenter);

        var transform = Transforms.eastNorthUpToFixedFrame(center, ellipsoid, tilt3DTransform);
        var verticalTransform = Transforms.eastNorthUpToFixedFrame(verticalCenter, newEllipsoid, tilt3DVerticalTransform);

        var oldGlobe = controller._globe;
        var oldEllipsoid = controller._ellipsoid;
        controller._globe = undefined;
        controller._ellipsoid = Ellipsoid.UNIT_SPHERE;
        controller._rotateFactor = 1.0;
        controller._rotateRateRangeAdjustment = 1.0;

        var constrainedAxis = Cartesian3.UNIT_Z;

        var oldTransform = Matrix4.clone(camera.transform, tilt3DOldTransform);
        camera._setTransform(transform);

        var tangent = Cartesian3.cross(verticalCenter, camera.positionWC, tilt3DCartesian3);
        var dot = Cartesian3.dot(camera.rightWC, tangent);

        rotate3D(controller, startPosition, movement, constrainedAxis, false, true);

        camera._setTransform(verticalTransform);

        if (dot < 0.0) {
            if (movement.startPosition.y > movement.endPosition.y) {
                constrainedAxis = undefined;
            }

            var oldConstrainedAxis = camera.constrainedAxis;
            camera.constrainedAxis = undefined;

            rotate3D(controller, startPosition, movement, constrainedAxis, true, false);

            camera.constrainedAxis = oldConstrainedAxis;
        } else {
            rotate3D(controller, startPosition, movement, constrainedAxis, true, false);
        }

        if (defined(camera.constrainedAxis)) {
            var right = Cartesian3.cross(camera.direction, camera.constrainedAxis, tilt3DCartesian3);
            if (!Cartesian3.equalsEpsilon(right, Cartesian3.ZERO, CesiumMath.EPSILON6)) {
                if (Cartesian3.dot(right, camera.right) < 0.0) {
                    Cartesian3.negate(right, right);
                }

                Cartesian3.cross(right, camera.direction, camera.up);
                Cartesian3.cross(camera.direction, camera.up, camera.right);

                Cartesian3.normalize(camera.up, camera.up);
                Cartesian3.normalize(camera.right, camera.right);
            }
        }

        camera._setTransform(oldTransform);
        controller._globe = oldGlobe;
        controller._ellipsoid = oldEllipsoid;

        var radius = oldEllipsoid.maximumRadius;
        controller._rotateFactor = 1.0 / radius;
        controller._rotateRateRangeAdjustment = radius;

        var originalPosition = Cartesian3.clone(camera.positionWC, tilt3DCartesian3);
        camera._adjustHeightForTerrain();

        if (!Cartesian3.equals(camera.positionWC, originalPosition)) {
            camera._setTransform(verticalTransform);
            camera.worldToCameraCoordinatesPoint(originalPosition, originalPosition);

            var magSqrd = Cartesian3.magnitudeSquared(originalPosition);
            if (Cartesian3.magnitudeSquared(camera.position) > magSqrd) {
                Cartesian3.normalize(camera.position, camera.position);
                Cartesian3.multiplyByScalar(camera.position, Math.sqrt(magSqrd), camera.position);
            }

            var angle = Cartesian3.angleBetween(originalPosition, camera.position);
            var axis = Cartesian3.cross(originalPosition, camera.position, originalPosition);
            Cartesian3.normalize(axis, axis);

            var quaternion = Quaternion.fromAxisAngle(axis, angle, tilt3DQuaternion);
            var rotation = Matrix3.fromQuaternion(quaternion, tilt3DMatrix);
            Matrix3.multiplyByVector(rotation, camera.direction, camera.direction);
            Matrix3.multiplyByVector(rotation, camera.up, camera.up);
            Cartesian3.cross(camera.direction, camera.up, camera.right);
            Cartesian3.cross(camera.right, camera.direction, camera.up);

            camera._setTransform(oldTransform);
        }
    }

    var look3DStartPos = new Cartesian2();
    var look3DEndPos = new Cartesian2();
    var look3DStartRay = new Ray();
    var look3DEndRay = new Ray();
    var look3DNegativeRot = new Cartesian3();
    var look3DTan = new Cartesian3();

    function look3D(controller, startPosition, movement, rotationAxis) {
        var scene = controller._scene;
        var camera = scene.camera;

        var startPos = look3DStartPos;
        startPos.x = movement.startPosition.x;
        startPos.y = 0.0;
        var endPos = look3DEndPos;
        endPos.x = movement.endPosition.x;
        endPos.y = 0.0;

        var startRay = camera.getPickRay(startPos, look3DStartRay);
        var endRay = camera.getPickRay(endPos, look3DEndRay);
        var angle = 0.0;
        var start;
        var end;

        if (camera.frustum instanceof OrthographicFrustum) {
            start = startRay.origin;
            end = endRay.origin;

            Cartesian3.add(camera.direction, start, start);
            Cartesian3.add(camera.direction, end, end);

            Cartesian3.subtract(start, camera.position, start);
            Cartesian3.subtract(end, camera.position, end);

            Cartesian3.normalize(start, start);
            Cartesian3.normalize(end, end);
        } else {
            start = startRay.direction;
            end = endRay.direction;
        }

        var dot = Cartesian3.dot(start, end);
        if (dot < 1.0) { // dot is in [0, 1]
            angle = Math.acos(dot);
        }

        angle = (movement.startPosition.x > movement.endPosition.x) ? -angle : angle;

        var horizontalRotationAxis = controller._horizontalRotationAxis;
        if (defined(rotationAxis)) {
            camera.look(rotationAxis, -angle);
        } else if (defined(horizontalRotationAxis)) {
            camera.look(horizontalRotationAxis, -angle);
        } else {
            camera.lookLeft(angle);
        }

        startPos.x = 0.0;
        startPos.y = movement.startPosition.y;
        endPos.x = 0.0;
        endPos.y = movement.endPosition.y;

        startRay = camera.getPickRay(startPos, look3DStartRay);
        endRay = camera.getPickRay(endPos, look3DEndRay);
        angle = 0.0;

        if (camera.frustum instanceof OrthographicFrustum) {
            start = startRay.origin;
            end = endRay.origin;

            Cartesian3.add(camera.direction, start, start);
            Cartesian3.add(camera.direction, end, end);

            Cartesian3.subtract(start, camera.position, start);
            Cartesian3.subtract(end, camera.position, end);

            Cartesian3.normalize(start, start);
            Cartesian3.normalize(end, end);
        } else {
            start = startRay.direction;
            end = endRay.direction;
        }

        dot = Cartesian3.dot(start, end);
        if (dot < 1.0) { // dot is in [0, 1]
            angle = Math.acos(dot);
        }
        angle = (movement.startPosition.y > movement.endPosition.y) ? -angle : angle;

        rotationAxis = defaultValue(rotationAxis, horizontalRotationAxis);
        if (defined(rotationAxis)) {
            var direction = camera.direction;
            var negativeRotationAxis = Cartesian3.negate(rotationAxis, look3DNegativeRot);
            var northParallel = Cartesian3.equalsEpsilon(direction, rotationAxis, CesiumMath.EPSILON2);
            var southParallel = Cartesian3.equalsEpsilon(direction, negativeRotationAxis, CesiumMath.EPSILON2);
            if ((!northParallel && !southParallel)) {
                dot = Cartesian3.dot(direction, rotationAxis);
                var angleToAxis = CesiumMath.acosClamped(dot);
                if (angle > 0 && angle > angleToAxis) {
                    angle = angleToAxis - CesiumMath.EPSILON4;
                }

                dot = Cartesian3.dot(direction, negativeRotationAxis);
                angleToAxis = CesiumMath.acosClamped(dot);
                if (angle < 0 && -angle > angleToAxis) {
                    angle = -angleToAxis + CesiumMath.EPSILON4;
                }

                var tangent = Cartesian3.cross(rotationAxis, direction, look3DTan);
                camera.look(tangent, angle);
            } else if ((northParallel && angle < 0) || (southParallel && angle > 0)) {
                camera.look(camera.right, -angle);
            }
        } else {
            camera.lookUp(angle);
        }
    }

    function update3D(controller) {
        reactToInput(controller, controller.enableRotate, controller.rotateEventTypes, spin3D, controller.inertiaSpin, '_lastInertiaSpinMovement');
        reactToInput(controller, controller.enableZoom, controller.zoomEventTypes, zoom3D, controller.inertiaZoom, '_lastInertiaZoomMovement');
        //reactToInput(controller, controller.enableTilt, controller.tiltEventTypes, tilt3D, controller.inertiaSpin, '_lastInertiaTiltMovement');
		//zhangli2018
        reactToInput(controller, controller.enableTilt, controller.tiltEventTypes, tilt3D, 2, '_lastInertiaTiltMovement');//controller.inertiaSpin
        reactToInput(controller, controller.enableLook, controller.lookEventTypes, look3D);
    }

    /**
     * @private
     */
    ScreenSpaceCameraController.prototype.update = function() {
        if (!Matrix4.equals(this._scene.camera.transform, Matrix4.IDENTITY)) {
            this._globe = undefined;
            this._ellipsoid = Ellipsoid.UNIT_SPHERE;
        } else {
            this._globe = this._scene.globe;
            this._ellipsoid = defined(this._globe) ? this._globe.ellipsoid : this._scene.mapProjection.ellipsoid;
        }

        this._minimumCollisionTerrainHeight = this.minimumCollisionTerrainHeight * this._scene.terrainExaggeration;
        this._minimumPickingTerrainHeight = this.minimumPickingTerrainHeight * this._scene.terrainExaggeration;
        this._minimumTrackBallHeight = this.minimumTrackBallHeight * this._scene.terrainExaggeration;

        var radius = this._ellipsoid.maximumRadius;
        this._rotateFactor = 1.0 / radius;
        this._rotateRateRangeAdjustment = radius;

        var scene = this._scene;
        var mode = scene.mode;
        if (mode === SceneMode.SCENE2D) {
            update2D(this);
        } else if (mode === SceneMode.COLUMBUS_VIEW) {
            this._horizontalRotationAxis = Cartesian3.UNIT_Z;
            updateCV(this);
        } else if (mode === SceneMode.SCENE3D) {
            this._horizontalRotationAxis = undefined;
            update3D(this);
        }

        this._aggregator.reset();
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
     *
     * @see ScreenSpaceCameraController#destroy
     */
    ScreenSpaceCameraController.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Removes mouse listeners held by this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     *
     * @example
     * controller = controller && controller.destroy();
     *
     * @see ScreenSpaceCameraController#isDestroyed
     */
    ScreenSpaceCameraController.prototype.destroy = function() {
        this._tweens.removeAll();
        this._aggregator = this._aggregator && this._aggregator.destroy();
        return destroyObject(this);
    };

    //return ScreenSpaceCameraController;
	Cesium.GeoScreenSpaceCameraController = ScreenSpaceCameraController;
//});
})(window.Cesium);
/**
 * Class: Cesium.LayerManager
 * 三维地图图层管理类
 * description: 管理各种图层组
 */
(function(Cesium){
	"use strict";

    /**
     * Constructor: Cesium.LayerManager
     *
     * Parameters:
     * map - {Cesium.Map} 3D map Object
     *
     */
	var LayerManager = Cesium.LayerManager = function(map){
		this.map = map;
		this.serviceLayerGroup = new Cesium.ServiceLayerGroup(map);
		this.modelLayerGroup = new Cesium.ModelLayerGroup(map);
		this.vectorLayerGroup = new Cesium.VectorLayerGroup(map);
		this.terrainLayerGroup = new Cesium.TerrainLayerGroup(map);
		this.basicLayerGroup = new Cesium.BasicLayerGroup(map);
	};

	/**
     * Method: getMap
     * 获取三维地图对象
     *
     * returns:
     * map {Cesium.Map} 三维地图对象
     */
	LayerManager.prototype.getMap = function(){
		return this.map;
	};

	/**
     * Method: getServiceLayerGroup
     * 获取业务图层组
     *
     * returns:
     * serviceLayerGroup 业务图层组
     */
	LayerManager.prototype.getServiceLayerGroup = function(){
		return this.serviceLayerGroup;
	};

	/**
     * Method: getModelLayerGroup
     * 获取模型图层组
     *
     * returns:
     * modelLayerGroup 模型图层组
     */
	LayerManager.prototype.getModelLayerGroup = function(){
		return this.modelLayerGroup;
	};

	/**
     * Method: getVectorLayerGroup
     * 获取矢量图层组
     *
     * returns:
     * vectorLayerGroup 矢量图层组
     */
	LayerManager.prototype.getVectorLayerGroup = function(){
		return this.vectorLayerGroup;
	};

	/**
     * Method: getTerrainLayerGroup
     * 获取地形图层组
     *
     * returns:
     * terrainLayerGroup 地形图层组
     */
	LayerManager.prototype.getTerrainLayerGroup = function(){
		return this.terrainLayerGroup;
	};

	/**
     * Method: getBasicLayerGroup
     * 获取基础图层组
     *
     * returns:
     * basicLayerGroup 基础图层组
     */
	LayerManager.prototype.getBasicLayerGroup = function(){
		return this.basicLayerGroup;
	};

	/**
     * Method: remove
     * 移除图层组
     *
     * Parameters:
     * layerGroup 指定图层组对象
     * or default 参数缺省时清空所有图层组
     */
	LayerManager.prototype.remove = function(layerGroup){
		if(!Cesium.defined(layerGroup)){
			this.serviceLayerGroup.removeAll();
			this.modelLayerGroup.removeAll();
			this.vectorLayerGroup.removeAll();
			this.terrainLayerGroup.removeAll();
			this.basicLayerGroup.removeAll();
		}else{
			layerGroup.removeAll();
		}
	};

})(window.Cesium);

/**
 * Class: Cesium.ServiceLayerGroup
 * 三维地图业务图层组类
 *
 * Inherits from:
 * - <Cesium.CompositeEntityCollection>
 */
(function(Cesium){
	"use strict";

	/**
     * Constructor: Cesium.ServiceLayerGroup
     */
	var ServiceLayerGroup = Cesium.ServiceLayerGroup = function(){

	};

	/**
     * extend: Cesium.CompositeEntityCollection
     */
	ServiceLayerGroup.prototype = new Cesium.CompositeEntityCollection();

	/**
     * Method: addLayer
     * 添加图层
     *
     * Parameters:
     * name 图层名称
     * layer 图层对象
     *
     * returns:
     * id 图层唯一标识码
     */
	ServiceLayerGroup.prototype.addLayer = function(name,layer){
		var callback = ServiceLayerGroup.add(layer);
		var id = "";
		if(callback){
			layer.name = name;
			id = Cesium.createGuid();
			layer.id = id;
		}
		return id;
	};

	/**
     * Method: removeLayer
     * 移除图层
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * returns:
     * boolean - {[Boolean]} true移除成功 false移除失败
     */
	ServiceLayerGroup.prototype.removeLayer = function(id){
		var layer = ServiceLayerGroup.getLayer(id);
		var boolean = ServiceLayerGroup.remove(layer);
		return boolean;
	};

	/**
     * Method: queryLayerByName
     * 通过图层名称获取图层对象
     *
     * Parameters:
     * name 图层名称
     *
     * returns:
     * targetLayer 图层对象
     */
	ServiceLayerGroup.prototype.queryLayerByName = function(name){
		var targetLayer = null;
		for(var i=0;i<ServiceLayerGroup.length;i++){
			var layer = ServiceLayerGroup.get(i);
			if(name == layer.name){
				targetLayer = layer;
				break;
			}
		}
		return targetLayer;
	};

	/**
     * Method: getLayer
     * 通过图层id获取图层对象
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * returns:
     * targetLayer 图层对象
     */
	ServiceLayerGroup.prototype.getLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<ServiceLayerGroup.length;i++){
			var layer = ServiceLayerGroup.get(i);
			if(id == layer.id){
				targetLayer = layer;
				break;
			}
		}
		return targetLayer;
	};

	/**
     * Method: showLayer
     * 图层显示
     *
     * Parameters:
     * id 图层唯一标识码
     */
	ServiceLayerGroup.prototype.showLayer = function(id){
		var layer = ServiceLayerGroup.getLayer(id);
		layer.show = true;
	};

	/**
     * Method: hideLayer
     * 图层隐藏
     *
     * Parameters:
     * id 图层唯一标识码
     */
	ServiceLayerGroup.prototype.hideLayer = function(id){
		var layer = ServiceLayerGroup.getLayer(id);
		layer.show = false;
	};

	/**
     * Method: addChildLayerGroup
     * 创建业务图层组节点
     *
     * Parameters:
     * name 业务图层组节点名称
     */
	ServiceLayerGroup.prototype.addChildLayerGroup = function(name){

	};

})(window.Cesium);

/**
 * Class: Cesium.ModelLayerGroup
 * 三维地图模型图层组类
 *
 * Inherits from:
 * - <Cesium.PrimitiveCollection>
 */
(function(Cesium){
	"use strict";

	/**
     * Constructor: Cesium.ModelLayerGroup
     */
	var ModelLayerGroup = Cesium.ModelLayerGroup = function(map){
		this.map = map;
	};

	/**
     * extend: Cesium.PrimitiveCollection
     */
	ModelLayerGroup.prototype = new Cesium.PrimitiveCollection();

	/**
     * Method: addLayer
     * 添加图层
     *
     * Parameters:
     * name 图层名称
     * layer 图层对象
     *
     * returns:
     * id 图层唯一标识码
     */
	ModelLayerGroup.prototype.addLayer = function(name,layer){
		var tileset = this.map.scene.primitives.add(layer);
		var id = "";
		if(tileset){
			layer.name = name;
			if($("#model-branch-container .layer-item-title").last()[0] != undefined){
				id = $("#model-branch-container .layer-item-title").last()[0].id;
			}
			layer.id = id;
		}
		return tileset;
	};

	/**
     * Method: removeLayer
     * 移除图层
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * returns:
     * boolean - {[Boolean]} true移除成功 false移除失败
     */
	ModelLayerGroup.prototype.removeLayer = function(id){
		for(var i=0;i<this.map.scene.primitives.length;i++){
			var layer = this.map.scene.primitives.get(i);
			if(id == layer.id){
				break;
			}
		}
		var boolean = this.map.scene.primitives.remove(layer);
		return boolean;
	};

	/**
     * Method: queryLayerByName
     * 通过图层名称获取图层对象
     *
     * Parameters:
     * name 图层名称
     *
     * returns:
     * targetLayer 图层对象
     */
	ModelLayerGroup.prototype.queryLayerByName = function(name){
		var targetLayer = null;
		for(var i=0;i<ModelLayerGroup.length;i++){
			var layer = ModelLayerGroup.get(i);
			if(name == layer.name){
				targetLayer = layer;
				break;
			}
		}
		return targetLayer;
	};

	/**
     * Method: getLayer
     * 通过图层id获取图层对象
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * returns:
     * targetLayer 图层对象
     */
	ModelLayerGroup.prototype.getLayer = function(id){
		var targetLayer = null;
		if(id){
			for(var i=1;i<this.map.scene.primitives.length;i++){
				var layer = this.map.scene.primitives.get(i);
				if(id == layer.id){
					targetLayer = layer;
					break;
				}
			}
		}else{
			targetLayer = this.map.scene.primitives._primitives;
		}

		return targetLayer;
	};

	/**
     * Method: showLayer
     * 图层显示
     *
     * Parameters:
     * id 图层唯一标识码
     */
	ModelLayerGroup.prototype.showLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.scene.primitives.length;i++){
			var layer = this.map.scene.primitives.get(i);
			if(id == layer.id){
				targetLayer = layer;
				break;
			}
		}
		if(targetLayer){
			targetLayer.show = true;
		}
	};

	/**
     * Method: hideLayer
     * 图层隐藏
     *
     * Parameters:
     * id 图层唯一标识码
     */
	ModelLayerGroup.prototype.hideLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.scene.primitives.length;i++){
			var layer = this.map.scene.primitives.get(i);
			if(id == layer.id){
				targetLayer = layer;
				break;
			}
		}
		if(targetLayer){
			targetLayer.show = false;
		}
	};

})(window.Cesium);

/**
 * Class: Cesium.VectorLayerGroup
 * 三维地图矢量图层组类
 *
 * Inherits from:
 * - <Cesium.DataSourceCollection>
 */
(function(Cesium){
	"use strict";

	/**
     * Constructor: Cesium.VectorLayerGroup
     */
	var VectorLayerGroup = Cesium.VectorLayerGroup = function(map){
		/**
         * @attributes:3d map.
         * @type {Cesium.Map}
         */
		this.map = map;
	};

	/**
     * extend: Cesium.DataSourceCollection
     */
	VectorLayerGroup.prototype = new Cesium.DataSourceCollection();

	/**
     * Method: addLayer
     * 添加图层
     *
     * Parameters:
     * name 图层名称
     * layer 图层对象
     *
     * returns:
     * id 图层唯一标识码
     */
	VectorLayerGroup.prototype.addLayer = function(name,dataSource){
		if(dataSource){
			if(!dataSource.id){
				dataSource.id = Cesium.createGuid();
			}
			//dataSource._name = name;
		}
		this.map.dataSources.add(dataSource);
		this.map.dataSources.get(this.map.dataSources.length-1).name = name;
		return dataSource.id;
	};

	/**
     * Method: removeLayer
     * 移除图层
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * returns:
     * boolean - {[Boolean]} true移除成功 false移除失败
     */
	VectorLayerGroup.prototype.removeLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.dataSources.length;i++){
				if(id == this.map.dataSources.get(i).id){
					targetLayer = this.map.dataSources.get(i);
					break;
				}
		}
		try{
			this.map.dataSources.remove(targetLayer);
		}catch(DeveloperError ){
			console.log("DeveloperError");
			return;
		}
	};

	/**
     * Method: queryLayerByName
     * 通过图层名称获取图层对象
     *
     * Parameters:
     * name 图层名称
     *
     * returns:
     * targetLayer 图层对象
     */
	VectorLayerGroup.prototype.queryLayerByName = function(name){
		var targetLayer = null;
		for(var i=0;i<this.map.dataSources.length;i++){
			var layer = this.map.dataSources.get(i);
			if(name == layer._name){
				targetLayer = layer;
				break;
			}
		}
		return targetLayer;
	};

	/**
     * Method: getLayer
     * 通过图层id获取图层对象
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * returns:
     * targetLayer 图层对象
     */
	VectorLayerGroup.prototype.getLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.dataSources.length;i++){
			var layer = this.map.dataSources.get(i);
			if(id == layer.id){
				targetLayer = layer;
				break;
			}
		}
		return targetLayer;
	};

	/**
     * Method: showLayer
     * 图层显示
     *
     * Parameters:
     * id 图层唯一标识码
     */
	VectorLayerGroup.prototype.showLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.dataSources.length;i++){
			var layer = this.map.dataSources.get(i);
			if(id == layer.id){
				targetLayer = layer;
				break;
			}
		};
		if(targetLayer){
			targetLayer.show = true;
		}
	};

	/**
     * Method: hideLayer
     * 图层隐藏
     *
     * Parameters:
     * id 图层唯一标识码
     */
	VectorLayerGroup.prototype.hideLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.dataSources.length;i++){
			var layer = this.map.dataSources.get(i);
			if(id == layer.id){
				targetLayer = layer;
				break;
			}
		};
		if(targetLayer){
			targetLayer.show = false;
		}
	};

})(window.Cesium);

/**
 * Class: Cesium.TerrainLayerCollection
 * An ordered collection of terrain layers.
 */
(function(Cesium){
	"use strict";

	/**
     * Constructor: Cesium.TerrainLayerCollection
     */
	var TerrainLayerCollection = Cesium.TerrainLayerCollection = function(map){
		/**
         * @attributes:layers in this collection.
         * @memberof TerrainLayerCollection.prototype
         * @type {Array}
         */
		this._layers = [];
		/**
         * @attributes:Gets the number of layers in this collection.
         * @memberof TerrainLayerCollection.prototype
         * @type {Number}
         */
		this.length = this._layers.length;
        /**
         * @attributes:3d map.
         * @type {Cesium.Map}
         */
		this.map = map;
	};

	/**
     * Method: addTerrainProvider
     * Creates a new layer using the given TerrainProvider and adds it to the collection
     *
     * Parameters:TerrainProvider
     * the terrain provider to create a new layer for
     *
     * returns:
     * The newly created layer
     */
	TerrainLayerCollection.prototype.addTerrainProvider = function(terrainProvider){
		if (!defined(terrainProvider)) {
            throw new Cesium.DeveloperError('terrainProvider is required.');
        }else{
        	this.map.terrainProvider = terrainProvider;
        	this._layers = [];
			this._layers.push(terrainProvider);
        }
		return this.map.terrainProvider;
	};

	/**
     * Method: remove
     * 移除图层
     *
     * returns:{Boolean}
     * true if the layer was in the collection and was removed,
	 * false if the layer was not in the collection.
     */
	TerrainLayerCollection.prototype.remove = function(){
		var defaultTerrainProvider = new Cesium.CesiumTerrainProvider({
		    url : ''
		});
		this.map.terrainProvider = defaultTerrainProvider;
		this._layers = [];
		return this.map.terrainProvider._url_size == 0;
	};

	/**
     * Method: get
     * 通过图层标识码获取图层对象
     *
     * Parameters:
     * id 图层名称
     *
     * returns:
     * targetLayer 图层对象
     */
	TerrainLayerCollection.prototype.get = function(id){
		if (!defined(terrainProvider)) {
            throw new Cesium.DeveloperError('id is required.');
            return;
        }else{
        	if(id == this._layers[0].id)
        	return this._layers[0];
        }
	};

})(window.Cesium);

/**
 * Class: Cesium.TerrainLayerGroup
 * 三维地图地形图层组类
 *
 * Inherits from:
 * - <Cesium.TerrainLayerCollection>
 */
(function(Cesium){
	"use strict";

	/**
     * Constructor: Cesium.TerrainLayerGroup
     */
	var TerrainLayerGroup = Cesium.TerrainLayerGroup = function(map){
		this.map = map;
	};

	/**
     * extend: Cesium.TerrainLayerCollection TODO
     */
//	TerrainLayerGroup.prototype = new Cesium.TerrainLayerCollection(map);

	/**
     * Method: addLayer
     * 添加图层
     *
     * Parameters:
     * name 图层名称
     * terrainProvider 图层数据
     *
     * returns:
     * id 图层唯一标识码
     */
	TerrainLayerGroup.prototype.addLayer = function(name,terrainProvider){
		if(terrainProvider._credit){
			terrainProvider.id = terrainProvider._credit._text;
		}else{
			var id = Cesium.createGuid();
			terrainProvider.id = id;
		}
		terrainProvider.name = name;
		this.map.terrainProvider = terrainProvider;
		return terrainProvider.id;
	};

	/**
     * Method: removeLayer
     * 移除图层
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * returns:
     * boolean - {[Boolean]} true移除成功 false移除失败
     */
	TerrainLayerGroup.prototype.removeLayer = function(id){
		if(id == this.map.terrainProvider.id){
			var newTerrainLayer = new Cesium.GeoTerrainProvider({
									proxy: new Cesium.DefaultProxy("/proxyHandler?url="),
									dataType: Cesium.GeoTerrainProvider.FLOAT,
						            urls: [""],
						        });
	        this.map.terrainProvider = newTerrainLayer;
		}
		return this.map.terrainProvider.id?false:true;
	};

	/**
     * Method: getLayer
     * 通过图层id获取图层对象
     *
     * Parameters:
     * id 图层唯一标识码,可缺省
     *
     * returns:
     * targetLayer 图层数据
     */
	TerrainLayerGroup.prototype.getLayer = function(id){
		var targetLayer = null;
		if(!Cesium.defined(id)){
			var targetLayer = this.map.terrainProvider;
		}else{
			if(id == this.map.terrainProvider.id){
				targetLayer = this.map.terrainProvider;
			}
		}
		return targetLayer;
	};

	/**
     * Method: showLayer
     * 图层显示
     *
     * Parameters:
     * id 图层唯一标识码
     */
	TerrainLayerGroup.prototype.showLayer = function(id){
		if(id == this.map.terrainProvider.options.credit){
			var trueTerrainLayer = new Cesium.GeoTerrainProvider({
											proxy: new Cesium.DefaultProxy("/proxyHandler?url="),
											dataType: Cesium.GeoTerrainProvider.FLOAT,
								            urls: this.map.terrainProvider.options._urls,
								            credit: this.map.terrainProvider.options.credit,
								            name: this.map.terrainProvider.options.name,
								            maxExtent: this.map.terrainProvider.options.maxExtent,
								            opacity: this.map.terrainProvider.options.opacity,
								            topLevel: this.map.terrainProvider.options.topLevel,
								            bottomLevel: this.map.terrainProvider.options.bottomLevel
						       		 });
       		trueTerrainLayer.id = id;
       		trueTerrainLayer.name = this.map.terrainProvider.options.name;
  		 	this.map.terrainProvider = trueTerrainLayer;
		}
	};

	/**
     * Method: hideLayer
     * 图层隐藏
     *
     * Parameters:
     * id 图层唯一标识码
     */
	TerrainLayerGroup.prototype.hideLayer = function(id){
		var targetLayer = null;
		if(id == this.map.terrainProvider.id){
			targetLayer = this.map.terrainProvider;
			var options = { _urls: targetLayer._urls,
							credit: targetLayer._credit.text,
							name: targetLayer.name,
							maxExtent: targetLayer._maxExtent,
							opacity: targetLayer._opacity,
							topLevel: targetLayer._topLevel,
							bottomLevel: targetLayer._bottomLevel
						  };
			var newTerrainLayer = new Cesium.GeoTerrainProvider({
										proxy: new Cesium.DefaultProxy("/proxyHandler?url="),
										dataType: Cesium.GeoTerrainProvider.FLOAT,
							            urls: [""],
							        });
	        this.map.terrainProvider = newTerrainLayer;
	        this.map.terrainProvider.options = options;
		}
	};

})(window.Cesium);

/**
 * Class: Cesium.BasicLayerGroup
 * 三维地图基础图层组类
 *
 * Inherits from:
 * - <Cesium.ImageryLayerCollection>
 */
(function(Cesium){
	"use strict";

	/**
     * Constructor: Cesium.BasicLayerGroup
     */
	var BasicLayerGroup = Cesium.BasicLayerGroup = function(map){
		this.map = map;
	};

	/**
     * extend: Cesium.ImageryLayerCollection
     */
	BasicLayerGroup.prototype = new Cesium.ImageryLayerCollection();

	/**
     * Method: addLayer
     * 添加图层
     *
     * Parameters:
     * name 图层名称
     * imageryProvider 图层数据
     *
     * returns:
     * id 图层唯一标识码
     */
	BasicLayerGroup.prototype.addLayer = function(name,imageryProvider){
		var layer = this.map.imageryLayers.addImageryProvider(imageryProvider);
		var id = "";
		if(layer){
			layer.name = name;
			for(var i=0; i<$("#imagery-branch-container .layer-item-content div").length; i++){
				var document = $("#imagery-branch-container .layer-item-content span")[i];
				if(name == document.innerText){
					id = $($("#imagery-branch-container .layer-item-content div")[i]).attr("id");
					break;
				}
			}
			layer.id = id;
		}
		return id;
	};

	/**
     * Method: removeLayer
     * 移除图层
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * returns:
     * boolean - {[Boolean]} true移除成功 false移除失败
     */
	BasicLayerGroup.prototype.removeLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.imageryLayers.length;i++){
				if(id == this.map.imageryLayers._layers[i].id){
					targetLayer = this.map.imageryLayers._layers[i];
					break;
				}
		}
		try{
			this.map.imageryLayers.remove(targetLayer);
		}catch(DeveloperError ){
			console.log("DeveloperError");
			return;
		}
	};

	/**
     * Method: queryLayerByName
     * 通过图层名称获取图层对象
     *
     * Parameters:
     * name 图层名称
     *
     * returns:
     * targetLayer 图层对象
     */
	BasicLayerGroup.prototype.queryLayerByName = function(name){
		if(!Cesium.defined(name)){return false;}
		var targetLayer = null;
		for(var i=0;i<this.map.imageryLayers.length;i++){
				if(name == this.map.imageryLayers._layers[i].name){
					targetLayer = this.map.imageryLayers._layers[i];
					break;
				}
		}
		return targetLayer;
	};

	/**
     * Method: getLayer
     * 通过图层id获取图层对象
     *
     * Parameters:
     * id 图层唯一标识码,可缺省
     *
     * returns:
     * targetLayer 图层对象
     */
	BasicLayerGroup.prototype.getLayer = function(id){
		var targetLayer = null;
		if(id){
			for(var i=0;i<this.map.imageryLayers.length;i++){
				if(id == this.map.imageryLayers._layers[i].id){
					targetLayer = this.map.imageryLayers._layers[i];
					break;
				}
			}
		}else{
			targetLayer = this.map.imageryLayers._layers;
		}
		return targetLayer;
	};

	/**
     * Method: showLayer
     * 图层显示
     *
     * Parameters:
     * id 图层唯一标识码
     */
	BasicLayerGroup.prototype.showLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.imageryLayers.length;i++){
				if(id == this.map.imageryLayers._layers[i].id){
					targetLayer = this.map.imageryLayers._layers[i];
					break;
				}
		}
		targetLayer.show = true;
	};

	/**
     * Method: hideLayer
     * 图层隐藏
     *
     * Parameters:
     * id 图层唯一标识码
     */
	BasicLayerGroup.prototype.hideLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.imageryLayers.length;i++){
				if(id == this.map.imageryLayers._layers[i].id){
					targetLayer = this.map.imageryLayers._layers[i];
					break;
				}
		}
		targetLayer.show = false;
	};

	/**
     * Method: moveLayer
     * 将某图层移动到另一图层上
     *
     * Parameters:
     * id1，id2 图层唯一标识码
     *
     * Exception:
     * DeveloperError layer is not in this collection
     */
	BasicLayerGroup.prototype.moveLayer = function(id1,id2){
		var layer1 = null;
		var layer2 = null;
		for(var i=0;i<this.map.imageryLayers.length;i++){
				if(id1 == this.map.imageryLayers._layers[i].id){
					layer1 = this.map.imageryLayers._layers[i];
					break;
				}
		}
		for(var i=0;i<this.map.imageryLayers.length;i++){
				if(id2 == this.map.imageryLayers._layers[i].id){
					layer2 = this.map.imageryLayers._layers[i];
					break;
				}
		}
		var index1 = this.map.imageryLayers.indexOf(layer1);
		var index2 = this.map.imageryLayers.indexOf(layer2);
		var index = index1 - index2;
		if(index > 0){
			for(var i=0;i<index;i++){
				try{
					this.map.imageryLayers.raise(layer1);
				}catch(DeveloperError ){
					console.log(DeveloperError);
					return;
				}
			}
		}else{
			console.log("layer located top");
		}
	};

	/**
     * Method: raiseLayer
     * 图层上移
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * Exception:
     * DeveloperError layer is not in this collection
     */
	BasicLayerGroup.prototype.raiseLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.imageryLayers.length;i++){
				if(id == this.map.imageryLayers._layers[i].id){
					targetLayer = this.map.imageryLayers._layers[i];
					break;
				}
			}
		try{
			this.map.imageryLayers.raise(targetLayer);
		}catch(DeveloperError ){
			console.log("DeveloperError");
			return;
		}
	};

	/**
     * Method: lowerLayer
     * 图层下移
     *
     * Parameters:
     * id 图层唯一标识码
     *
     * Exception:
     * DeveloperError layer is not in this collection
     */
	BasicLayerGroup.prototype.lowerLayer = function(id){
		var targetLayer = null;
		for(var i=0;i<this.map.imageryLayers.length;i++){
				if(id == this.map.imageryLayers._layers[i].id){
					targetLayer = this.map.imageryLayers._layers[i];
					break;
				}
			}
		try{
			this.map.imageryLayers.lower(targetLayer);
		}catch(DeveloperError ){
			console.log("DeveloperError");
			return;
		}
	};

})(window.Cesium);
(function(Cesium){
    "use strict";
    /**
     * 三维地图量算类
     *
     * @alias Measure
     * @constructor
     *
     * @param {Object} [options] 对象具有以下属性:
     * @param {Cesium.Viewer} [options.viewer=""].
     *
     * @example
     * // 初始化控件.
     * var Measure = new Cesium.Measure({
     *     viewer：viewr
     * });
     */
    var Measure = Cesium.Measure = function (options) {
        this.viewer = options.viewer;
        this.primitives = this.viewer.scene.primitives;
    };
    /**
     * 距离计算：默认单位为米，超过1000米换算成千米.
     *
     * @param {Cesium.Entity} [entity].
     * @param {Number} [mode] 1：空间量算，2：贴地量算.
     * @returns {String} 距离计算结果.
     */
    Measure.prototype.distance = function(entity,mode){
        if(!entity.polyline) return;
        var array = entity.polyline.positions.getValue();
        if(array.length<=1) return;
        var distance = 0;//贴地
        var distance2 = 0;//空间
        var result;
        var geodesic = new Cesium.EllipsoidGeodesic();
        for(var i=1;i<array.length;i++){
            var startCartographic = Cesium.Cartographic.fromCartesian(array[i-1]);
            var endCartographic = Cesium.Cartographic.fromCartesian(array[i]);
            geodesic.setEndPoints(startCartographic, endCartographic);
            var lengthInMeters = Math.round(geodesic.surfaceDistance);
            distance +=lengthInMeters;

            var cartographic1 = Cesium.Cartographic.fromCartesian(array[i-1]);
            var lng1 = Cesium.Math.toDegrees(cartographic1.longitude);
            var lat1 = Cesium.Math.toDegrees(cartographic1.latitude);
            var cartographic2 = Cesium.Cartographic.fromCartesian(array[i]);
            var lng2 = Cesium.Math.toDegrees(cartographic2.longitude);
            var lat2 = Cesium.Math.toDegrees(cartographic2.latitude);
            var from = turf.point([lng1, lat1]);
            var to = turf.point([lng2, lat2]);
            distance2 +=turf.distance(from, to);
        }
        if(mode==2){
            if(distance<1000){
                result = distance.toFixed(2)+"m";
            }else{
                result = (distance/1000).toFixed(2)+"km";
            }
        }else if(mode==1){
            if(distance2<1){
                result = (distance2*1000).toFixed(2)+"m";
            }else{
                result = (distance2).toFixed(2)+"km";
            }
        }
        return result;
    };
    /**
     * 面积计算：默认单位为平方米，超过1000000平方米换算为平方千米.
     *
     * @param {Cesium.Entity} [entity].
     * @returns {String} 面积计算结果.
     */
    Measure.prototype.area = function(entity){
        if(!entity.polygon) return;
        var array = entity.polygon.hierarchy.getValue().positions;
        if(array.length<=2) return;
        var tempArray = [];
        for(var i=0;i<array.length;i++){
            var cartographic = Cesium.Cartographic.fromCartesian(array[i]);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            tempArray.push([lng,lat]);
        }
        //首尾相连
        tempArray.push(tempArray[0]);
        var polygon = turf.polygon([tempArray]);
        var area = turf.area(polygon);
        var result;
        if(area<1000000){
            result = area.toFixed(2)+"m²";
        }else{
            result = (area/1000000).toFixed(2)+"km²";
        }
        return result;
    };
    /**
     * 高度计算：默认单位为米，超过1000米则换算成千米.
     *
     * @param {Cesium.Entity} [entity].
     * @returns {Object} 两点的垂直高度计算结果、水平距离计算结果、空间距离计算结果.
     */
    Measure.prototype.height = function(entity){
        if(!entity.polyline) return;
        var array = entity.polyline.positions.getValue();
        array = [array[0],array[1]];
        if(array.length!=2) return;
        var tempArray = [];
        for(var i=0;i<array.length;i++){
            var cartographic = Cesium.Cartographic.fromCartesian(array[i]);
            var lng = Cesium.Math.toDegrees(cartographic.longitude);
            var lat = Cesium.Math.toDegrees(cartographic.latitude);
            var height = cartographic.height;
            tempArray.push(lng);
            tempArray.push(lat);
            tempArray.push(height);
        }
        //根据两个点的位置判断第三个点的位置（比较高度）
        if(tempArray[2]>=tempArray[5]){
            tempArray.push(tempArray[0]);
            tempArray.push(tempArray[1]);
            tempArray.push(tempArray[5]);
        }else{
            tempArray.push(tempArray[3]);
            tempArray.push(tempArray[4]);
            tempArray.push(tempArray[2]);
        }
        var result = {
            horizontalDistance:null,
            verticalHeight:null,
            spaceDistance:null
        };
        //水平距离(m)
        var horizontalDistance= turf.distance(turf.point([tempArray[0], tempArray[1]]), turf.point([tempArray[3], tempArray[4]]))*1000;
        var temp = [];
        temp.push((tempArray[0]+tempArray[3])/2);
        temp.push((tempArray[1]+tempArray[4])/2);
        if(tempArray[2]>=tempArray[5]){
            temp.push(tempArray[5]);
        }else{
            temp.push(tempArray[2]);
        }
        if(horizontalDistance<1000){
            result.horizontalDistance = "水平距离："+horizontalDistance.toFixed(2)+"m";
        }else{
            result.horizontalDistance = "水平距离："+(horizontalDistance/1000).toFixed(2)+"km";
        }

        //垂直高度(m)
        var verticalHeight =Math.abs(tempArray[2]-tempArray[5]);
        var temp = [];
        if(tempArray[2]>=tempArray[5]){
            temp.push(tempArray[0]);
            temp.push(tempArray[1]);
        }else{
            temp.push(tempArray[3]);
            temp.push(tempArray[4]);
        }
        temp.push((tempArray[2]+tempArray[5])/2);
        if(verticalHeight<1000){
            result.verticalHeight = "垂直高度："+verticalHeight.toFixed(2)+"m";
        }else{
            result.verticalHeight = "垂直高度："+(verticalHeight/1000).toFixed(2)+"km";
        }
        //空间距离(m)
        var spaceDistance = Math.sqrt(Math.pow(horizontalDistance,2)+Math.pow(verticalHeight,2));
        var temp = [];
        temp.push((tempArray[0]+tempArray[3])/2);
        temp.push((tempArray[1]+tempArray[4])/2);
        temp.push((tempArray[2]+tempArray[5])/2);
        if(spaceDistance<1000){
            result.spaceDistance = "空间距离："+spaceDistance.toFixed(2)+"m";
        }else{
            result.spaceDistance = "空间距离："+(spaceDistance/1000).toFixed(2)+"km";
        }
        return result;

    };
    /**
     * 高程计算：默认单位为米.
     *
     * @param {Cesium.Entity} [entity].
     * @returns {String} 当前点的高程值.
     */
    Measure.prototype.elevation = function(entity){
        if(!entity.point) return;
        var array = [entity.position._value];
        if(array.length!=1) return;
        var cartographic = Cesium.Cartographic.fromCartesian(array[0]);
        var elevation = cartographic.height;
        var result = "高程值："+elevation.toFixed(2)+"m";
        createResultLabel2(this.options,this.primitives,array);
    };
})(window.Cesium);
(function(Cesium){
	"use strict";
	
    /**
     * 矢量瓦片Provider类。
     *
     * @alias MVTProvider
     * @constructor
     *
     * @param {Object} [options] 参数选项:
     * @param {Object} [options.ol=ol] 默认为ol，openlayers 的ol命名空间。
     * @param {String} [options.url=""] 默认为""，矢量瓦片的服务地址。
     * @param {String} [options.layer=""] 默认为""，矢量瓦片的图层名称。
     * @param {String} [options.tileMatrixSetID=""] 默认为""，矢量瓦片的矩阵集名称。
     * @param {String} [options.styleName=""] 默认为""，矢量瓦片的样式名称。
     * 
     * @example
     * //初始化三维球
     * var viewer = new Cesium.Map("cesiumContainer");
     * 
     * //web墨卡托投影
     * var mvtLayer = new Cesium.MVTProvider({
     * 	  proxy: new Cesium.DefaultProxy(Cfg.proxyHostUrl),//设置代理地址。
     * 	  ol: ol,
     * 	  url: "http://192.168.100.231:8889/xz_mkt/wmts",
     * 	  layer: "XZMKT_SQLITE",
     * 	  tileMatrixSetID: "Matrix_XZMKT_SQLITE_0",
     * 	  styleName: "Oracle.xzmkt_sqlite"
     * });
     * //经纬度投影
     * var mvtLayer = new Cesium.MVTProvider({
     * 	  proxy: new Cesium.DefaultProxy(Cfg.proxyHostUrl),//设置代理地址。
     * 	  ol: ol,
     * 	  url: "http://192.168.36.80:9010/xzvec/wmts",
     * 	  layer: "xz",
     * 	  tileMatrixSetID: "Matrix_xz_0",
     * 	  styleName: "xzstyle.xz",
     * 	  tilingScheme: new Cesium.GeographicTilingScheme(),
     * 	  tileMatrixLabels: ['1', '2', '3', '4', 
     * 	  '5', '6', '7', '8', '9', '10','11', 
     * 	  '12', '13', '14', '15', '16', '17', '18']
     * });
     * 
     * viewer.imageryLayers.addImageryProvider(mvtProvider);
     */
	var MVTProvider = Cesium.MVTProvider = function(options){
		
		options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

        this._tilingScheme = Cesium.defined(options.tilingScheme) ? options.tilingScheme : new Cesium.WebMercatorTilingScheme({ ellipsoid : options.ellipsoid });
        this._tileWidth = Cesium.defaultValue(options.tileWidth, 512);
        this._tileHeight = Cesium.defaultValue(options.tileHeight, 512);
        this._readyPromise = Cesium.when.resolve(true);
        this._ol = Cesium.defaultValue(options.ol, ol);
        this._mvtParser = new this._ol.format.MVT();
		this._proxy = options.proxy;
		
		this._layer = options.layer;
        this._styleName = options.styleName;
        this._tileMatrixSetID = options.tileMatrixSetID;
		this._tileMatrixLabels = options.tileMatrixLabels;
        this._format = "protobuf";

        //this._styleFun = createMapboxStreetsV6Style;
		
        this._key = Cesium.defaultValue(options.key, "");
        this._url = Cesium.defaultValue(options.url, "https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/{z}/{x}/{y}.vector.pbf?access_token={k}");

        var sw = this._tilingScheme._rectangleSouthwestInMeters;
        var ne = this._tilingScheme._rectangleNortheastInMeters;
		
		var mapExtent = null;
		if(!sw){
			var rectangle = this._tilingScheme.rectangle;
			//this._tilingScheme.getNumberOfYTilesAtLevel(level);
		}
        //var mapExtent = [sw.x,sw.y,ne.x,ne.y];
		if(this._tilingScheme instanceof Cesium.WebMercatorTilingScheme){
			mapExtent = [-20037508.342789244, -20037508.342789244, 20037508.342789244, 20037508.342789244];
		}else if(this._tilingScheme instanceof Cesium.GeographicTilingScheme){
			mapExtent = [-180, -270, 180, 90];
		}
		
        this._resolutions = ol.tilegrid.resolutionsFromExtent(mapExtent, 22, this._tileWidth);
        this._pixelRatio = 1;
        this._transform = [0.125,0,0,0.125,0,0];
        this._replays =  ["Default","Image","Polygon", "LineString","Text"];

        this._tileQueue = new Cesium.TileReplacementQueue();
        this._cacheSize = 1000;
		
		
		this.styleFunc = function(){return [];};
		var that = this;
		
		//请求样式
		var styleUrl = this.getStyleUrl();
		styleUrl = this._proxy.getURL(styleUrl);
		var promise = Cesium.loadJson(styleUrl);
		promise.then(function(glStyle){
			
			var source_id = "mysourceid";
	        for (var i = 0; i < glStyle.layers.length; i++) {
	            glStyle.layers[i].source = source_id;
	        }
			glStyle["sources"] = glStyle["sources"] || {};
			glStyle["sources"][source_id] = {
			    "type": "vector",
			    "url": options.url
			};
			if(glStyle.sprite){
				glStyle.sprite = Cfg.proxyHostUrl + glStyle.sprite;
			}
			if(glStyle.glyphs) {
				glStyle.glyphs = Cfg.proxyHostUrl + glStyle.glyphs;
			}
			//olms.stylefunction(myLayer, glStyle, source_id, null, glStyle.sprite + ".json", glStyle.sprite+".png", glStyle.glyphs);
			var prom = olms.applyStyle(null, glStyle, source_id, null, that._resolutions);
			prom.then(function(styleFunc){
				that.styleFunc = styleFunc;
			});
		});
//		Cesium.when(promise, function(glStyle) {
//            debugger;
//        }).otherwise(function(error) {
//			debugger;
//		});
	};
	
	
	Cesium.defineProperties(MVTProvider.prototype, {
		
		url : {
            get : function() {
                return this._url;
            }
        },
		
        proxy : {
            get : function() {
                return this._proxy;
            }
        },

        tileWidth : {
            get : function() {
                return this._tileWidth;
            }
        },

        tileHeight: {
            get : function() {
                return this._tileHeight;
            }
        },

        maximumLevel : {
            get : function() {
                return undefined;
            }
        },

        minimumLevel : {
            get : function() {
                return undefined;
            }
        },

        tilingScheme : {
            get : function() {
                return this._tilingScheme;
            }
        },

        rectangle : {
            get : function() {
                return this._tilingScheme.rectangle;
            }
        },

        tileDiscardPolicy : {
            get : function() {
                return undefined;
            }
        },

        errorEvent : {
            get : function() {
                return this._errorEvent;
            }
        },

        ready : {
            get : function() {
                return true;
            }
        },

        readyPromise : {
            get : function() {
                return this._readyPromise;
            }
        },

        credit : {
            get : function() {
                return undefined;
            }
        },

        hasAlphaChannel : {
            get : function() {
                return true;
            }
        }
    });

    MVTProvider.prototype.getTileCredits = function(x, y, level) {
        return undefined;
    };

    function findTileInQueue(x, y, level,tileQueue){
        var item = tileQueue.head;
        while(item != undefined && !(item.xMvt == x && item.yMvt ==y && item.zMvt == level)){
            item = item.replacementNext;
        }
        return item;
    };

    function remove(tileReplacementQueue, item) {
        var previous = item.replacementPrevious;
        var next = item.replacementNext;

        if (item === tileReplacementQueue._lastBeforeStartOfFrame) {
            tileReplacementQueue._lastBeforeStartOfFrame = next;
        }

        if (item === tileReplacementQueue.head) {
            tileReplacementQueue.head = next;
        } else {
            previous.replacementNext = next;
        }

        if (item === tileReplacementQueue.tail) {
            tileReplacementQueue.tail = previous;
        } else {
            next.replacementPrevious = previous;
        }

        item.replacementPrevious = undefined;
        item.replacementNext = undefined;

        --tileReplacementQueue.count;
    }

    function trimTiles(tileQueue,maximumTiles) {
        var tileToTrim = tileQueue.tail;
        while (tileQueue.count > maximumTiles &&
               Cesium.defined(tileToTrim)) {
            var previous = tileToTrim.replacementPrevious;

            remove(tileQueue, tileToTrim);
            //delete tileToTrim;
            tileToTrim = null;

            tileToTrim = previous;
        }
    };

    MVTProvider.prototype.requestImage = function(x, y, level, request) {
		var labels = this._tileMatrixLabels;
        var z = Cesium.defined(labels) ? labels[level] : level.toString();
		
        var cacheTile = findTileInQueue(x, y, z, this._tileQueue);
        if(cacheTile != undefined){
            return cacheTile;
        }
        else{
            var that = this;
            //var url = this._url;
            var url = this.getUrlTmpl();
            url = url.replace('{x}', x).replace('{y}', y).replace('{z}', z).replace('{k}', this._key);
			
			url = this._proxy.getURL(url);
            var tilerequest = function(x,y,z){
                return Cesium.loadArrayBuffer(url).then(function(arrayBuffer) {
                    var canvas = document.createElement('canvas');
                    canvas.width = 512;
                    canvas.height = 512;
                    var vectorContext = canvas.getContext('2d');
        
                    var features = that._mvtParser.readFeatures(arrayBuffer);
        
                    //var styleFun = that._styleFun();
					var styleFun = that.styleFunc;
					
                    var extent = [0,0,4096,4096];
                    var _replayGroup = new ol.render.canvas.ReplayGroup(0, extent,
                        8,true,100);
        
                    for(var i=0;i<features.length;i++){
                        var feature = features[i];
                        var styles = styleFun(features[i],that._resolutions[z]) || [];
                        for(var j=0;j<styles.length;j++)
                        {
                            ol.renderer.vector.renderFeature_(_replayGroup, feature, styles[j],16);
                        }
                    }
                    _replayGroup.finish();
                    
                    _replayGroup.replay(vectorContext, that._pixelRatio, that._transform, 0, {}, that._replays, true);
                    if(that._tileQueue.count>that._cacheSize){
                        trimTiles(that._tileQueue,that._cacheSize/2);
                    }

                    canvas.xMvt = x;
                    canvas.yMvt = y;
                    canvas.zMvt = z;
                    that._tileQueue.markTileRendered(canvas);

                    //delete _replayGroup;
                    _replayGroup = null;

                    return canvas;
                }).otherwise(function(error) {
					console.error(error);
                });
            }(x,y,z);
        }
    };

    MVTProvider.prototype.pickFeatures = function(x, y, level, longitude, latitude) {
        return undefined;
    };
	
	MVTProvider.prototype.getUrlTmpl = function(){
		var defaultParameters = {
	        SERVICE : 'WMTS',
	        VERSION : '1.0.0',
	        REQUEST : 'GetTile'
	    };
		var queryOptions = {
			LAYER: this._layer,
			TILEMATRIXSET: this._tileMatrixSetID,
			FORMAT: this._format,
			TILEMATRIX: '{z}',
	        TILEROW: '{y}',
	        TILECOL: '{x}'
		};
		var paramStr =this.getParameterString(Cesium.combine(defaultParameters, queryOptions));
		var urlTmpl = this._url + "?" + paramStr;
		return urlTmpl;
	};
	MVTProvider.prototype.getStyleUrl = function(){
		var defaultParameters = {
	        SERVICE : 'WMTS',
	        VERSION : '1.0.0',
	        REQUEST : 'GetStyle'
	    };
		var queryOptions = {
			STYLENAME: this._styleName,
		};
		var paramStr =this.getParameterString(Cesium.combine(defaultParameters, queryOptions));
		var styleUrl = this._url + "?" + paramStr;
		return styleUrl;
	};
	MVTProvider.prototype.getParameterString = function(params) {
        var paramsArray = [];
        for (var key in params) {
            var value = params[key];
            if ((value != null) && (typeof value != 'function')) {
                var encodedValue;
                if (typeof value == 'object' && value.constructor == Array) {
                    /* value is an array; encode items and separate with "," */
                    var encodedItemArray = [];
                    var item;
                    for (var itemIndex=0, len=value.length; itemIndex<len; itemIndex++) {
                        item = value[itemIndex];
                        encodedItemArray.push((item === null || item === undefined) ? "" : item);
                    }
                    encodedValue = encodedItemArray.join(",");
                }
                else {
                    /* value is a string; simply encode */
                    encodedValue = value;
                }
                paramsArray.push(key + "=" + encodedValue);
            }
        }
        return paramsArray.join("&");
    };
	
})(window.Cesium);
/** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */(function() {'use strict';function l(d){throw d;}var v=void 0,x=!0,aa=this;function D(d,a){var c=d.split("."),e=aa;!(c[0]in e)&&e.execScript&&e.execScript("var "+c[0]);for(var b;c.length&&(b=c.shift());)!c.length&&a!==v?e[b]=a:e=e[b]?e[b]:e[b]={}};var F="undefined"!==typeof Uint8Array&&"undefined"!==typeof Uint16Array&&"undefined"!==typeof Uint32Array&&"undefined"!==typeof DataView;function H(d,a){this.index="number"===typeof a?a:0;this.i=0;this.buffer=d instanceof(F?Uint8Array:Array)?d:new (F?Uint8Array:Array)(32768);2*this.buffer.length<=this.index&&l(Error("invalid index"));this.buffer.length<=this.index&&this.f()}H.prototype.f=function(){var d=this.buffer,a,c=d.length,e=new (F?Uint8Array:Array)(c<<1);if(F)e.set(d);else for(a=0;a<c;++a)e[a]=d[a];return this.buffer=e};
H.prototype.d=function(d,a,c){var e=this.buffer,b=this.index,f=this.i,g=e[b],h;c&&1<a&&(d=8<a?(N[d&255]<<24|N[d>>>8&255]<<16|N[d>>>16&255]<<8|N[d>>>24&255])>>32-a:N[d]>>8-a);if(8>a+f)g=g<<a|d,f+=a;else for(h=0;h<a;++h)g=g<<1|d>>a-h-1&1,8===++f&&(f=0,e[b++]=N[g],g=0,b===e.length&&(e=this.f()));e[b]=g;this.buffer=e;this.i=f;this.index=b};H.prototype.finish=function(){var d=this.buffer,a=this.index,c;0<this.i&&(d[a]<<=8-this.i,d[a]=N[d[a]],a++);F?c=d.subarray(0,a):(d.length=a,c=d);return c};
var fa=new (F?Uint8Array:Array)(256),O;for(O=0;256>O;++O){for(var P=O,Q=P,ga=7,P=P>>>1;P;P>>>=1)Q<<=1,Q|=P&1,--ga;fa[O]=(Q<<ga&255)>>>0}var N=fa;function ha(d){this.buffer=new (F?Uint16Array:Array)(2*d);this.length=0}ha.prototype.getParent=function(d){return 2*((d-2)/4|0)};ha.prototype.push=function(d,a){var c,e,b=this.buffer,f;c=this.length;b[this.length++]=a;for(b[this.length++]=d;0<c;)if(e=this.getParent(c),b[c]>b[e])f=b[c],b[c]=b[e],b[e]=f,f=b[c+1],b[c+1]=b[e+1],b[e+1]=f,c=e;else break;return this.length};
ha.prototype.pop=function(){var d,a,c=this.buffer,e,b,f;a=c[0];d=c[1];this.length-=2;c[0]=c[this.length];c[1]=c[this.length+1];for(f=0;;){b=2*f+2;if(b>=this.length)break;b+2<this.length&&c[b+2]>c[b]&&(b+=2);if(c[b]>c[f])e=c[f],c[f]=c[b],c[b]=e,e=c[f+1],c[f+1]=c[b+1],c[b+1]=e;else break;f=b}return{index:d,value:a,length:this.length}};function R(d){var a=d.length,c=0,e=Number.POSITIVE_INFINITY,b,f,g,h,k,n,q,r,p,m;for(r=0;r<a;++r)d[r]>c&&(c=d[r]),d[r]<e&&(e=d[r]);b=1<<c;f=new (F?Uint32Array:Array)(b);g=1;h=0;for(k=2;g<=c;){for(r=0;r<a;++r)if(d[r]===g){n=0;q=h;for(p=0;p<g;++p)n=n<<1|q&1,q>>=1;m=g<<16|r;for(p=n;p<b;p+=k)f[p]=m;++h}++g;h<<=1;k<<=1}return[f,c,e]};function ia(d,a){this.h=ma;this.w=0;this.input=F&&d instanceof Array?new Uint8Array(d):d;this.b=0;a&&(a.lazy&&(this.w=a.lazy),"number"===typeof a.compressionType&&(this.h=a.compressionType),a.outputBuffer&&(this.a=F&&a.outputBuffer instanceof Array?new Uint8Array(a.outputBuffer):a.outputBuffer),"number"===typeof a.outputIndex&&(this.b=a.outputIndex));this.a||(this.a=new (F?Uint8Array:Array)(32768))}var ma=2,na={NONE:0,r:1,k:ma,O:3},oa=[],S;
for(S=0;288>S;S++)switch(x){case 143>=S:oa.push([S+48,8]);break;case 255>=S:oa.push([S-144+400,9]);break;case 279>=S:oa.push([S-256+0,7]);break;case 287>=S:oa.push([S-280+192,8]);break;default:l("invalid literal: "+S)}
ia.prototype.j=function(){var d,a,c,e,b=this.input;switch(this.h){case 0:c=0;for(e=b.length;c<e;){a=F?b.subarray(c,c+65535):b.slice(c,c+65535);c+=a.length;var f=a,g=c===e,h=v,k=v,n=v,q=v,r=v,p=this.a,m=this.b;if(F){for(p=new Uint8Array(this.a.buffer);p.length<=m+f.length+5;)p=new Uint8Array(p.length<<1);p.set(this.a)}h=g?1:0;p[m++]=h|0;k=f.length;n=~k+65536&65535;p[m++]=k&255;p[m++]=k>>>8&255;p[m++]=n&255;p[m++]=n>>>8&255;if(F)p.set(f,m),m+=f.length,p=p.subarray(0,m);else{q=0;for(r=f.length;q<r;++q)p[m++]=
f[q];p.length=m}this.b=m;this.a=p}break;case 1:var s=new H(F?new Uint8Array(this.a.buffer):this.a,this.b);s.d(1,1,x);s.d(1,2,x);var w=pa(this,b),y,ja,A;y=0;for(ja=w.length;y<ja;y++)if(A=w[y],H.prototype.d.apply(s,oa[A]),256<A)s.d(w[++y],w[++y],x),s.d(w[++y],5),s.d(w[++y],w[++y],x);else if(256===A)break;this.a=s.finish();this.b=this.a.length;break;case ma:var C=new H(F?new Uint8Array(this.a.buffer):this.a,this.b),Ea,M,U,V,W,gb=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],ba,Fa,ca,Ga,ka,ra=Array(19),
Ha,X,la,z,Ia;Ea=ma;C.d(1,1,x);C.d(Ea,2,x);M=pa(this,b);ba=qa(this.M,15);Fa=sa(ba);ca=qa(this.L,7);Ga=sa(ca);for(U=286;257<U&&0===ba[U-1];U--);for(V=30;1<V&&0===ca[V-1];V--);var Ja=U,Ka=V,I=new (F?Uint32Array:Array)(Ja+Ka),t,J,u,da,G=new (F?Uint32Array:Array)(316),E,B,K=new (F?Uint8Array:Array)(19);for(t=J=0;t<Ja;t++)I[J++]=ba[t];for(t=0;t<Ka;t++)I[J++]=ca[t];if(!F){t=0;for(da=K.length;t<da;++t)K[t]=0}t=E=0;for(da=I.length;t<da;t+=J){for(J=1;t+J<da&&I[t+J]===I[t];++J);u=J;if(0===I[t])if(3>u)for(;0<
u--;)G[E++]=0,K[0]++;else for(;0<u;)B=138>u?u:138,B>u-3&&B<u&&(B=u-3),10>=B?(G[E++]=17,G[E++]=B-3,K[17]++):(G[E++]=18,G[E++]=B-11,K[18]++),u-=B;else if(G[E++]=I[t],K[I[t]]++,u--,3>u)for(;0<u--;)G[E++]=I[t],K[I[t]]++;else for(;0<u;)B=6>u?u:6,B>u-3&&B<u&&(B=u-3),G[E++]=16,G[E++]=B-3,K[16]++,u-=B}d=F?G.subarray(0,E):G.slice(0,E);ka=qa(K,7);for(z=0;19>z;z++)ra[z]=ka[gb[z]];for(W=19;4<W&&0===ra[W-1];W--);Ha=sa(ka);C.d(U-257,5,x);C.d(V-1,5,x);C.d(W-4,4,x);for(z=0;z<W;z++)C.d(ra[z],3,x);z=0;for(Ia=d.length;z<
Ia;z++)if(X=d[z],C.d(Ha[X],ka[X],x),16<=X){z++;switch(X){case 16:la=2;break;case 17:la=3;break;case 18:la=7;break;default:l("invalid code: "+X)}C.d(d[z],la,x)}var La=[Fa,ba],Ma=[Ga,ca],L,Na,ea,ua,Oa,Pa,Qa,Ra;Oa=La[0];Pa=La[1];Qa=Ma[0];Ra=Ma[1];L=0;for(Na=M.length;L<Na;++L)if(ea=M[L],C.d(Oa[ea],Pa[ea],x),256<ea)C.d(M[++L],M[++L],x),ua=M[++L],C.d(Qa[ua],Ra[ua],x),C.d(M[++L],M[++L],x);else if(256===ea)break;this.a=C.finish();this.b=this.a.length;break;default:l("invalid compression type")}return this.a};
function ta(d,a){this.length=d;this.H=a}
var va=function(){function d(b){switch(x){case 3===b:return[257,b-3,0];case 4===b:return[258,b-4,0];case 5===b:return[259,b-5,0];case 6===b:return[260,b-6,0];case 7===b:return[261,b-7,0];case 8===b:return[262,b-8,0];case 9===b:return[263,b-9,0];case 10===b:return[264,b-10,0];case 12>=b:return[265,b-11,1];case 14>=b:return[266,b-13,1];case 16>=b:return[267,b-15,1];case 18>=b:return[268,b-17,1];case 22>=b:return[269,b-19,2];case 26>=b:return[270,b-23,2];case 30>=b:return[271,b-27,2];case 34>=b:return[272,
b-31,2];case 42>=b:return[273,b-35,3];case 50>=b:return[274,b-43,3];case 58>=b:return[275,b-51,3];case 66>=b:return[276,b-59,3];case 82>=b:return[277,b-67,4];case 98>=b:return[278,b-83,4];case 114>=b:return[279,b-99,4];case 130>=b:return[280,b-115,4];case 162>=b:return[281,b-131,5];case 194>=b:return[282,b-163,5];case 226>=b:return[283,b-195,5];case 257>=b:return[284,b-227,5];case 258===b:return[285,b-258,0];default:l("invalid length: "+b)}}var a=[],c,e;for(c=3;258>=c;c++)e=d(c),a[c]=e[2]<<24|e[1]<<
16|e[0];return a}(),wa=F?new Uint32Array(va):va;
function pa(d,a){function c(b,c){var a=b.H,d=[],e=0,f;f=wa[b.length];d[e++]=f&65535;d[e++]=f>>16&255;d[e++]=f>>24;var g;switch(x){case 1===a:g=[0,a-1,0];break;case 2===a:g=[1,a-2,0];break;case 3===a:g=[2,a-3,0];break;case 4===a:g=[3,a-4,0];break;case 6>=a:g=[4,a-5,1];break;case 8>=a:g=[5,a-7,1];break;case 12>=a:g=[6,a-9,2];break;case 16>=a:g=[7,a-13,2];break;case 24>=a:g=[8,a-17,3];break;case 32>=a:g=[9,a-25,3];break;case 48>=a:g=[10,a-33,4];break;case 64>=a:g=[11,a-49,4];break;case 96>=a:g=[12,a-
65,5];break;case 128>=a:g=[13,a-97,5];break;case 192>=a:g=[14,a-129,6];break;case 256>=a:g=[15,a-193,6];break;case 384>=a:g=[16,a-257,7];break;case 512>=a:g=[17,a-385,7];break;case 768>=a:g=[18,a-513,8];break;case 1024>=a:g=[19,a-769,8];break;case 1536>=a:g=[20,a-1025,9];break;case 2048>=a:g=[21,a-1537,9];break;case 3072>=a:g=[22,a-2049,10];break;case 4096>=a:g=[23,a-3073,10];break;case 6144>=a:g=[24,a-4097,11];break;case 8192>=a:g=[25,a-6145,11];break;case 12288>=a:g=[26,a-8193,12];break;case 16384>=
a:g=[27,a-12289,12];break;case 24576>=a:g=[28,a-16385,13];break;case 32768>=a:g=[29,a-24577,13];break;default:l("invalid distance")}f=g;d[e++]=f[0];d[e++]=f[1];d[e++]=f[2];var h,k;h=0;for(k=d.length;h<k;++h)p[m++]=d[h];w[d[0]]++;y[d[3]]++;s=b.length+c-1;r=null}var e,b,f,g,h,k={},n,q,r,p=F?new Uint16Array(2*a.length):[],m=0,s=0,w=new (F?Uint32Array:Array)(286),y=new (F?Uint32Array:Array)(30),ja=d.w,A;if(!F){for(f=0;285>=f;)w[f++]=0;for(f=0;29>=f;)y[f++]=0}w[256]=1;e=0;for(b=a.length;e<b;++e){f=h=0;
for(g=3;f<g&&e+f!==b;++f)h=h<<8|a[e+f];k[h]===v&&(k[h]=[]);n=k[h];if(!(0<s--)){for(;0<n.length&&32768<e-n[0];)n.shift();if(e+3>=b){r&&c(r,-1);f=0;for(g=b-e;f<g;++f)A=a[e+f],p[m++]=A,++w[A];break}0<n.length?(q=xa(a,e,n),r?r.length<q.length?(A=a[e-1],p[m++]=A,++w[A],c(q,0)):c(r,-1):q.length<ja?r=q:c(q,0)):r?c(r,-1):(A=a[e],p[m++]=A,++w[A])}n.push(e)}p[m++]=256;w[256]++;d.M=w;d.L=y;return F?p.subarray(0,m):p}
function xa(d,a,c){var e,b,f=0,g,h,k,n,q=d.length;h=0;n=c.length;a:for(;h<n;h++){e=c[n-h-1];g=3;if(3<f){for(k=f;3<k;k--)if(d[e+k-1]!==d[a+k-1])continue a;g=f}for(;258>g&&a+g<q&&d[e+g]===d[a+g];)++g;g>f&&(b=e,f=g);if(258===g)break}return new ta(f,a-b)}
function qa(d,a){var c=d.length,e=new ha(572),b=new (F?Uint8Array:Array)(c),f,g,h,k,n;if(!F)for(k=0;k<c;k++)b[k]=0;for(k=0;k<c;++k)0<d[k]&&e.push(k,d[k]);f=Array(e.length/2);g=new (F?Uint32Array:Array)(e.length/2);if(1===f.length)return b[e.pop().index]=1,b;k=0;for(n=e.length/2;k<n;++k)f[k]=e.pop(),g[k]=f[k].value;h=ya(g,g.length,a);k=0;for(n=f.length;k<n;++k)b[f[k].index]=h[k];return b}
function ya(d,a,c){function e(b){var c=k[b][n[b]];c===a?(e(b+1),e(b+1)):--g[c];++n[b]}var b=new (F?Uint16Array:Array)(c),f=new (F?Uint8Array:Array)(c),g=new (F?Uint8Array:Array)(a),h=Array(c),k=Array(c),n=Array(c),q=(1<<c)-a,r=1<<c-1,p,m,s,w,y;b[c-1]=a;for(m=0;m<c;++m)q<r?f[m]=0:(f[m]=1,q-=r),q<<=1,b[c-2-m]=(b[c-1-m]/2|0)+a;b[0]=f[0];h[0]=Array(b[0]);k[0]=Array(b[0]);for(m=1;m<c;++m)b[m]>2*b[m-1]+f[m]&&(b[m]=2*b[m-1]+f[m]),h[m]=Array(b[m]),k[m]=Array(b[m]);for(p=0;p<a;++p)g[p]=c;for(s=0;s<b[c-1];++s)h[c-
1][s]=d[s],k[c-1][s]=s;for(p=0;p<c;++p)n[p]=0;1===f[c-1]&&(--g[0],++n[c-1]);for(m=c-2;0<=m;--m){w=p=0;y=n[m+1];for(s=0;s<b[m];s++)w=h[m+1][y]+h[m+1][y+1],w>d[p]?(h[m][s]=w,k[m][s]=a,y+=2):(h[m][s]=d[p],k[m][s]=p,++p);n[m]=0;1===f[m]&&e(m)}return g}
function sa(d){var a=new (F?Uint16Array:Array)(d.length),c=[],e=[],b=0,f,g,h,k;f=0;for(g=d.length;f<g;f++)c[d[f]]=(c[d[f]]|0)+1;f=1;for(g=16;f<=g;f++)e[f]=b,b+=c[f]|0,b<<=1;f=0;for(g=d.length;f<g;f++){b=e[d[f]];e[d[f]]+=1;h=a[f]=0;for(k=d[f];h<k;h++)a[f]=a[f]<<1|b&1,b>>>=1}return a};function T(d,a){this.l=[];this.m=32768;this.e=this.g=this.c=this.q=0;this.input=F?new Uint8Array(d):d;this.s=!1;this.n=za;this.C=!1;if(a||!(a={}))a.index&&(this.c=a.index),a.bufferSize&&(this.m=a.bufferSize),a.bufferType&&(this.n=a.bufferType),a.resize&&(this.C=a.resize);switch(this.n){case Aa:this.b=32768;this.a=new (F?Uint8Array:Array)(32768+this.m+258);break;case za:this.b=0;this.a=new (F?Uint8Array:Array)(this.m);this.f=this.K;this.t=this.I;this.o=this.J;break;default:l(Error("invalid inflate mode"))}}
var Aa=0,za=1,Ba={F:Aa,D:za};
T.prototype.p=function(){for(;!this.s;){var d=Y(this,3);d&1&&(this.s=x);d>>>=1;switch(d){case 0:var a=this.input,c=this.c,e=this.a,b=this.b,f=a.length,g=v,h=v,k=e.length,n=v;this.e=this.g=0;c+1>=f&&l(Error("invalid uncompressed block header: LEN"));g=a[c++]|a[c++]<<8;c+1>=f&&l(Error("invalid uncompressed block header: NLEN"));h=a[c++]|a[c++]<<8;g===~h&&l(Error("invalid uncompressed block header: length verify"));c+g>a.length&&l(Error("input buffer is broken"));switch(this.n){case Aa:for(;b+g>e.length;){n=
k-b;g-=n;if(F)e.set(a.subarray(c,c+n),b),b+=n,c+=n;else for(;n--;)e[b++]=a[c++];this.b=b;e=this.f();b=this.b}break;case za:for(;b+g>e.length;)e=this.f({v:2});break;default:l(Error("invalid inflate mode"))}if(F)e.set(a.subarray(c,c+g),b),b+=g,c+=g;else for(;g--;)e[b++]=a[c++];this.c=c;this.b=b;this.a=e;break;case 1:this.o(Ca,Da);break;case 2:Sa(this);break;default:l(Error("unknown BTYPE: "+d))}}return this.t()};
var Ta=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],Ua=F?new Uint16Array(Ta):Ta,Va=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258],Wa=F?new Uint16Array(Va):Va,Xa=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0],Ya=F?new Uint8Array(Xa):Xa,Za=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],$a=F?new Uint16Array(Za):Za,ab=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,
10,11,11,12,12,13,13],bb=F?new Uint8Array(ab):ab,cb=new (F?Uint8Array:Array)(288),Z,db;Z=0;for(db=cb.length;Z<db;++Z)cb[Z]=143>=Z?8:255>=Z?9:279>=Z?7:8;var Ca=R(cb),eb=new (F?Uint8Array:Array)(30),fb,hb;fb=0;for(hb=eb.length;fb<hb;++fb)eb[fb]=5;var Da=R(eb);function Y(d,a){for(var c=d.g,e=d.e,b=d.input,f=d.c,g=b.length,h;e<a;)f>=g&&l(Error("input buffer is broken")),c|=b[f++]<<e,e+=8;h=c&(1<<a)-1;d.g=c>>>a;d.e=e-a;d.c=f;return h}
function ib(d,a){for(var c=d.g,e=d.e,b=d.input,f=d.c,g=b.length,h=a[0],k=a[1],n,q;e<k&&!(f>=g);)c|=b[f++]<<e,e+=8;n=h[c&(1<<k)-1];q=n>>>16;d.g=c>>q;d.e=e-q;d.c=f;return n&65535}
function Sa(d){function a(a,b,c){var d,e=this.z,f,g;for(g=0;g<a;)switch(d=ib(this,b),d){case 16:for(f=3+Y(this,2);f--;)c[g++]=e;break;case 17:for(f=3+Y(this,3);f--;)c[g++]=0;e=0;break;case 18:for(f=11+Y(this,7);f--;)c[g++]=0;e=0;break;default:e=c[g++]=d}this.z=e;return c}var c=Y(d,5)+257,e=Y(d,5)+1,b=Y(d,4)+4,f=new (F?Uint8Array:Array)(Ua.length),g,h,k,n;for(n=0;n<b;++n)f[Ua[n]]=Y(d,3);if(!F){n=b;for(b=f.length;n<b;++n)f[Ua[n]]=0}g=R(f);h=new (F?Uint8Array:Array)(c);k=new (F?Uint8Array:Array)(e);
d.z=0;d.o(R(a.call(d,c,g,h)),R(a.call(d,e,g,k)))}T.prototype.o=function(d,a){var c=this.a,e=this.b;this.u=d;for(var b=c.length-258,f,g,h,k;256!==(f=ib(this,d));)if(256>f)e>=b&&(this.b=e,c=this.f(),e=this.b),c[e++]=f;else{g=f-257;k=Wa[g];0<Ya[g]&&(k+=Y(this,Ya[g]));f=ib(this,a);h=$a[f];0<bb[f]&&(h+=Y(this,bb[f]));e>=b&&(this.b=e,c=this.f(),e=this.b);for(;k--;)c[e]=c[e++-h]}for(;8<=this.e;)this.e-=8,this.c--;this.b=e};
T.prototype.J=function(d,a){var c=this.a,e=this.b;this.u=d;for(var b=c.length,f,g,h,k;256!==(f=ib(this,d));)if(256>f)e>=b&&(c=this.f(),b=c.length),c[e++]=f;else{g=f-257;k=Wa[g];0<Ya[g]&&(k+=Y(this,Ya[g]));f=ib(this,a);h=$a[f];0<bb[f]&&(h+=Y(this,bb[f]));e+k>b&&(c=this.f(),b=c.length);for(;k--;)c[e]=c[e++-h]}for(;8<=this.e;)this.e-=8,this.c--;this.b=e};
T.prototype.f=function(){var d=new (F?Uint8Array:Array)(this.b-32768),a=this.b-32768,c,e,b=this.a;if(F)d.set(b.subarray(32768,d.length));else{c=0;for(e=d.length;c<e;++c)d[c]=b[c+32768]}this.l.push(d);this.q+=d.length;if(F)b.set(b.subarray(a,a+32768));else for(c=0;32768>c;++c)b[c]=b[a+c];this.b=32768;return b};
T.prototype.K=function(d){var a,c=this.input.length/this.c+1|0,e,b,f,g=this.input,h=this.a;d&&("number"===typeof d.v&&(c=d.v),"number"===typeof d.G&&(c+=d.G));2>c?(e=(g.length-this.c)/this.u[2],f=258*(e/2)|0,b=f<h.length?h.length+f:h.length<<1):b=h.length*c;F?(a=new Uint8Array(b),a.set(h)):a=h;return this.a=a};
T.prototype.t=function(){var d=0,a=this.a,c=this.l,e,b=new (F?Uint8Array:Array)(this.q+(this.b-32768)),f,g,h,k;if(0===c.length)return F?this.a.subarray(32768,this.b):this.a.slice(32768,this.b);f=0;for(g=c.length;f<g;++f){e=c[f];h=0;for(k=e.length;h<k;++h)b[d++]=e[h]}f=32768;for(g=this.b;f<g;++f)b[d++]=a[f];this.l=[];return this.buffer=b};
T.prototype.I=function(){var d,a=this.b;F?this.C?(d=new Uint8Array(a),d.set(this.a.subarray(0,a))):d=this.a.subarray(0,a):(this.a.length>a&&(this.a.length=a),d=this.a);return this.buffer=d};function jb(d){if("string"===typeof d){var a=d.split(""),c,e;c=0;for(e=a.length;c<e;c++)a[c]=(a[c].charCodeAt(0)&255)>>>0;d=a}for(var b=1,f=0,g=d.length,h,k=0;0<g;){h=1024<g?1024:g;g-=h;do b+=d[k++],f+=b;while(--h);b%=65521;f%=65521}return(f<<16|b)>>>0};function kb(d,a){var c,e;this.input=d;this.c=0;if(a||!(a={}))a.index&&(this.c=a.index),a.verify&&(this.N=a.verify);c=d[this.c++];e=d[this.c++];switch(c&15){case lb:this.method=lb;break;default:l(Error("unsupported compression method"))}0!==((c<<8)+e)%31&&l(Error("invalid fcheck flag:"+((c<<8)+e)%31));e&32&&l(Error("fdict flag is not supported"));this.B=new T(d,{index:this.c,bufferSize:a.bufferSize,bufferType:a.bufferType,resize:a.resize})}
kb.prototype.p=function(){var d=this.input,a,c;a=this.B.p();this.c=this.B.c;this.N&&(c=(d[this.c++]<<24|d[this.c++]<<16|d[this.c++]<<8|d[this.c++])>>>0,c!==jb(a)&&l(Error("invalid adler-32 checksum")));return a};var lb=8;function mb(d,a){this.input=d;this.a=new (F?Uint8Array:Array)(32768);this.h=$.k;var c={},e;if((a||!(a={}))&&"number"===typeof a.compressionType)this.h=a.compressionType;for(e in a)c[e]=a[e];c.outputBuffer=this.a;this.A=new ia(this.input,c)}var $=na;
mb.prototype.j=function(){var d,a,c,e,b,f,g,h=0;g=this.a;d=lb;switch(d){case lb:a=Math.LOG2E*Math.log(32768)-8;break;default:l(Error("invalid compression method"))}c=a<<4|d;g[h++]=c;switch(d){case lb:switch(this.h){case $.NONE:b=0;break;case $.r:b=1;break;case $.k:b=2;break;default:l(Error("unsupported compression type"))}break;default:l(Error("invalid compression method"))}e=b<<6|0;g[h++]=e|31-(256*c+e)%31;f=jb(this.input);this.A.b=h;g=this.A.j();h=g.length;F&&(g=new Uint8Array(g.buffer),g.length<=
h+4&&(this.a=new Uint8Array(g.length+4),this.a.set(g),g=this.a),g=g.subarray(0,h+4));g[h++]=f>>24&255;g[h++]=f>>16&255;g[h++]=f>>8&255;g[h++]=f&255;return g};function nb(d,a){var c,e,b,f;if(Object.keys)c=Object.keys(a);else for(e in c=[],b=0,a)c[b++]=e;b=0;for(f=c.length;b<f;++b)e=c[b],D(d+"."+e,a[e])};D("Zlib.Inflate",kb);D("Zlib.Inflate.prototype.decompress",kb.prototype.p);nb("Zlib.Inflate.BufferType",{ADAPTIVE:Ba.D,BLOCK:Ba.F});D("Zlib.Deflate",mb);D("Zlib.Deflate.compress",function(d,a){return(new mb(d,a)).j()});D("Zlib.Deflate.prototype.compress",mb.prototype.j);nb("Zlib.Deflate.CompressionType",{NONE:$.NONE,FIXED:$.r,DYNAMIC:$.k});}).call(this); //@ sourceMappingURL=zlib.min.js.map
