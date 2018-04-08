/**
 * Created by 张未然 on 2016/4/21.
 */



;(function(factory){
    if(typeof define === 'function' && define.amd ){
        //以AMD模式加载，RequireJS中用。
        define(['jquery','jqueryTransit'],factory);
    }else if(jQuery){
        //以jQuery引入模式加载。
        factory(jQuery,jQuery.fn.transition);
    }else{
        throw "Neither AMD nor jQuery is prepared for zuiFrame!";
    }
}(function($){

    'use strict';

    var ZUI;//zui类对象

    var DEFAULTS = {
        topMenuSelc: "#module",
        topSettingsSelc:"#settings",
        leftPanelSelc: "#left-panel",
        mainPanelSelc: "#main-panel-wrapper",
        locationPanelSelc: "#localtion-panel",
        infoMaskSelc:"#info-mask",
        processingBoxSelc:"#processing-box",
        default_top_index: 0,
        default_sub_index: 0,
        collapseWidth: "60px",
        leftPanelCollapsed: false,
        allowDuplicatedClick: true,
        rememberCollapseState:false,
    };

    var opts;//内部变量持有对象

    ZUI = function(options){
       //公共变量
    };

    ZUI.prototype = {
        constructor : ZUI,

        init : function(options,actualPage){
            opts = $.extend({},DEFAULTS,options);
            //是否完成初始化
            opts.initialized = false;
            //是否开启动画
            opts.fx = true;
            opts.fxEasing = "snap";
            opts.browser = _browserCheck();
            opts.path = {
                "menuURL":"/menu.json",
                "menuIndex" : {},
                "frame":null,
                "module":null,
                "items":[],
                isPageChanged:true,
            };
            opts.trans = {
                'ajaxTimeout' : 60000,
                'errorInfoLastingTime' : 10000,
                'loadingPanelShowingAfter' : 20000
            };
            opts.top = {
                "$menuPanel" : $(opts.topMenuSelc), //含有menu的<ul>
                "$menuItems" : [],//menu中具体的item项。这里读不到。在代码中初始化
                "$menuSlider" : null,//topMenu的红线
                "$selectedMenuItem" : null,//被选中的menu项：指向li级别
            };
            opts.left = {
                "$panel" : $(opts.leftPanelSelc),
                "isCollapsed":false,
                '$menuPanel': $(opts.leftPanelSelc).find('#left-panel-list'),
                "$toggle" : $(opts.leftPanelSelc + "-toggle"),//负责收缩左侧菜单的按钮元素
                "$arrow" : $(opts.leftPanelSelc + "-arrow"),//按钮元素中的箭头元素。主要用来改变方向。
                "$version" : $(opts.leftPanelSelc + "-version"),//右下角version元素
                "uncollapseWith" : $(opts.leftPanelSelc).css('width'), //左边框原始宽度。
                "collapseWith" : '60px', //左边框收缩宽度。
                "menuGroupCollapsed" : {},
                "$selectedSubMenuGroup" : null,
                "$selectedMenuItem" : null
            };
            opts.main = {
                "$panel" : $(opts.mainPanelSelc),
            };
            opts.dialog = {
                "$processing" : $(opts.processingBoxSelc),
                '$mask':$(opts.infoMaskSelc),
                "successInfoLast":1000,
                "infoTimeoutID":-1,
                "isProcessingShown":false,
                "successSVGPath":"M14.1 27.2l7.1 7.2 16.7-16.8",
                'failSVGPath':"M15 15 37 37 M37 15 15 37",
                "confirmSVGPath":"M26 10 L26 30 M26 35 L26 40",
            };
            opts.location = {
                $panel : $(opts.locationPanelSelc),
            };
            opts.support = {
                transition : true,
                svg : true,
                history : true,
            };
            //opts define END===========
            opts = _fallback(opts);
            var zui = this;
           /* if(opts.fx){
                //如果支持动画,将checkMark这个形式加入到jq.transit的$.cssEase中。这样以后就可以用这个效果了
                $.cssEase['checkMark'] = 'cubic-bezier(0.65, 0, 0.45, 1)';
            }*/
            this.processing();
            _parsePath(actualPage);
            this.communicate(opts.path.menuURL,{'name':'default'})
                .done(function(data){
                    try{
                        _buildMenuHtml(data.menu);
                        _initTop();
                        _initLeft(zui);
                        _adjustMenuIndex(actualPage);
                        _initMain();
                        _initInfoBox(zui);
                        _initHistory(zui);
                        zui.updateLocation(actualPage);
                        //暴露外部变量
                        _expose(zui);
                        $('body').trigger("afterFrameInit.zui");
                        //bug fix-20161020：登陆后台后第一次不会记录历史（因为不是loadPage或者communicate来的），这里手动记录一次
                        zui.pushInHistory(window.location.pathname,null,true);
                        //bug fix-20161020 end
                        zui.processed(true);
                    }catch (err){
                        zui.processed(false,null,err);
                        throw err;
                    }
                });
            return this;
        },

        /**
         * public method for loading json data from server
         * return Jquery AjaxObject for caller doing custmized operation.
         * handle error message as unity form which showing a temporary message box for data error.
         * @param {string} url - 交互的url
         * @param {string=} data - 发送的数据
         * @param {Object=} ajaxSettings - jq AJAX属性覆盖
         * @param {boolean=} isSilence - 是否静默载入（不记录在历史中） ，默认true->不记录
         * @param {boolean|string=} usingAnimation - 是否显示操作进度提示。默认false。如果为String=操作成功后提示框文字
         */
        communicate : function(url, data, ajaxSettings, isSilence, usingAnimation){
            var that = this;
            if(typeof isSilence === "undefined") isSilence=true;
            if(typeof usingAnimation === 'undefined') usingAnimation = false;
            url = this.buildPath(url);
            var settings = {
                type:'post',
                data:data,
                timeout : opts.trans.ajaxTimeout,
                dataType:"json",
                context:that,
                // contentType:"application/json",
                error:function(jqXHR, textStatus, errorThrown){
                    that.handleTransDataError(jqXHR, textStatus, errorThrown);
                },
                success : function(result,textStatus,jqXHR){
                    if(usingAnimation){
                        if($.type(usingAnimation) === "string"){
                            that.processed(true,usingAnimation);
                        }else{
                            that.processed(true,"操作成功");
                        }
                    }
                    if(!isSilence){
                        that.pushInHistory(url,data);
                    }
                }
            };
            if(!$.isEmptyObject(ajaxSettings)){
                $.extend(settings,ajaxSettings);
            }
            if(usingAnimation){
                zui.processing("提交数据...");
            }
            return $.ajax(url,settings);
        },

        /**
         * Ajax载入页面到MainDIV中。
         * @param loadUrl 要载入的url。这里如果url地址前有斜杠("/article") 表示绝对地址最后会加上frame的url部分 => /admin/article
         *                              如果url中没有斜杠("article") 表示相对地址，即在当前url后增加这一部分 => /跳转前url/article
         * @param postData 附加的数据
         * @param recordHistory 是否通过ZUIFrame记录进入Ajax方式时间的历史中。默认true。如果记录历史，当前页即支持浏览器前进后退功能
         * @param ajaxSettings 设置ajax请求，即JQ原始$.ajax（url,settings）中的settings。
         * @returns {*}
         */
        loadPage : function(loadUrl,postData,recordHistory,ajaxSettings){
            if(loadUrl=='/'||loadUrl=='/entrance') return;
            loadUrl = this.buildPath(loadUrl);
            /*
             待优化？
             //想法是如果重复点击同一个栏目就不直接post而不是get，因为这样可以节省载入index框架和zui初始化
             //但是目前isPageChanged的获取比较麻烦，暂时废弃了。所以不起作用
             //以后可以换个方式实现
            if(!opts.path.isPageChanged){
                this.communicate(load_url,load_data,ajaxSettings,true,false);
                return;
            }*/
            var that = this;
            var settings = {
                data : postData,
                type:'post',
                timeout : opts.trans.ajaxTimeout,
                context:that,
                beforeSend : function(jqXHR,settings){
                    // if(load_data==='') return false;
                    // timeout = setTimeout(function(){
                    //     opts.dialog.$loadingBox.show();
                    // },opts.trans.loadingPanelShowingAfter);
                },
                success : function(data,textStatus,jqXHR){
                    that._showMainPage(data,loadUrl,postData,recordHistory);
                },
                complete : function(jqXHR,settings) {
                    // clearTimeout(timeout);
                    // opts.dialog.$loadingBox.hide();
                },
                error: function(jqXHR,settings){
                    // opts.dialog.$loadingBox.hide();
                    that._showMainPage(jqXHR.responseText,loadUrl,postData,recordHistory);
                }
            };
            if(!$.isEmptyObject(ajaxSettings)){
                $.extend(settings,ajaxSettings);
            }
            return $.ajax(loadUrl,settings);
        },
        /**
         * 处理数据前后台传输的错误信息
         */
        handleTransDataError : function(jqXHR, textStatus, errorThrown ){
            var msg = "";
            var redirectURL = null;
            var code = null;
            var noError = false;

            //no error
            if(jqXHR.status === 200){
                return true;
            }
            if(errorThrown ==="timeout"){
                msg = "服务器繁忙，请稍后再试！"
            }else if(jqXHR.status===1001){
                //自定义的错误
                msg = jqXHR.msg;
            }else{
                if(jqXHR.responseText){
                    try{
                        var errors = JSON.parse(jqXHR.responseText);
                        if(errors.msg){
                            msg = errors.msg;
                        }else{
                            msg = errorThrown ;
                        }
                        if(errors.redirectURL){
                            redirectURL = errors.redirectURL;
                        }
                        if(errors.code){
                            code = errors.code;
                        }
                    }catch(err){
                        msg = errorThrown ;
                    }
                }else{
                    msg = errorThrown ;
                }
            }
            if(jqXHR.status === 401){
                this.processed(false,"无权访问",msg,{
                    text:"重新登录",
                    onclick:function(){
                        location.href = redirectURL!=null?redirectURL:"/login";
                    }
                });
            }else{
                this.processed(false,"操作失败",msg);
            }
            return noError;
        },
        /**
         * 使$elem相对其父元素垂直居中。
         * @param $elem 需要垂直居中的元素
         */
        vCenter : function($elem){
            $elem.css('position','absolute');
            $elem.css('top',($elem.parent().height()-$elem.outerHeight())/2+'px');
        },

        /**
         * 判断一个字符变量是否为空包括未定义，null,""和"null"四中情况
         * @param ajaxField
         * @returns {boolean}
         */

        isEmptyStr : function(str){
            return typeof str === 'undefined'||str===null||str==="null"||str==="";
        },

        /**
         * 判断是否为定义
         * 返回undifined,"undifined"," "均视为空
         */
        isUDF : function(obj){
            return !obj || obj===null;
        },

        /**
         * 查看一个$object对象是否包含dom元素
         * @param $object
         */
        isJQDom : function($object){
            if($object instanceof jQuery){
                return $object.length>0;
            }
            return false;
        },

        /**
         * 查看一个JQ是否包含子元素
         * @param $obj
         * @returns {*|boolean}
         */
        hasDom : function($obj){
          return this.isJQDom($obj)&&$obj.has().length>0;
        },


        /**
         * 判断是否存在Ajax历史记录（即需要相应Ajax跳转的历史记录）
         */
        hasHistory : function(){
            var lastState = window.history.state;
            return lastState && lastState.id>0;
        },

        /**
         * Ajax History 后退
         */
        back : function(){
            window.history.back();
        },

        /**
         * Ajax History 前进
         */
        forward : function(){
            window.history.forward();
        },

        /**
         * 程序加载对话框
         * @param text
         */
        processing :　function(text){
            if(!text) text="加载中...";
            opts.dialog.$processing.removeClass("success")
                .removeClass("failed")
                .removeClass('confirm')
                .children().each(function(){
                if($(this).is('.simple-info')){
                    $(this).children().each(function(){
                        if($(this).is('img')){
                            $(this).show();
                        }else if($(this).is('span')){
                            $(this).html(text);
                        }else if($(this).is('svg')){
                            $(this).hide();
                        }
                    })
                }else{
                    $(this).hide();
                }
            });
            _showProccessBox();
        },

        /**
         * 后台执行任务完成，前台显示执行结果的对话框。
         * 一般要和processing成对出现使用。
         * @param success {boolean|null} 执行结果 true-成功 false-失败 null-警告
         * @param title 对话框标题
         * @param reason 失败的原因。注意：如果这个field为空，操作失败出现一个提示框，过一段时间自动消失。
         *                               如果不空，操作失败会出现一个确认框，需要点击按钮。
         * @param backBtn --{text,onclick} 出现失败确认框的情况下,定制点击按钮。默认只是对话框消失。
         *                                   text- 按钮名称
         *                                   function - 点击执行的逻辑
         */
        processed : function(success,title,reason,backBtn){
            if(!title) title=success?"加载完成":"载入失败";
            opts.dialog.$processing.addClass(function(){
                    switch(success){
                        case true:return "success";
                        case false: return "failed";
                        case null:return "confirm";
                        default: return "failed";
                    }
                }).removeClass(function(){
                    switch(success){
                        case true:return "failed confirm";
                        case false: return "success confirm";
                        case null:return "success failed";
                    }
                })
                .children().each(function(){
                if($(this).is('.simple-info')){
                    $(this).children().each(function(){
                        if($(this).is('img')){
                            $(this).hide();
                        }else if($(this).is('span')){
                            $(this).html(title);
                        }else if($(this).is('svg')){
                            $(this).children('path').attr('d',success?opts.dialog.successSVGPath:success===null?opts.dialog.confirmSVGPath:opts.dialog.failSVGPath);
                            $(this).show();
                        }
                    })
                }else{
                    if(!success&&reason){
                        //-Added by zwr@20160607 processing->processed(true) 过程中，中间插入processed(false)
                        // 比方说后mainAjax又有错误了，错误显示会自动消失。这里再show取消定时消失逻辑、
                        //-Modified zwr@20160612 约定好processing，proccessed成对出现，那么不可能出现processing->processed(true)->processed(false)的情况
                        //如果后来又需要processed(false)，那么在此先在交互前执行proccessing就可以了。他是全局对象，在哪里调用都可以的。
                        _showProccessBox();
                        $(this).children('.info-msg').html(reason);
                        if(!!backBtn&&!!backBtn.text){
                            $(this).children('.info-btn').html(backBtn.text);
                        }
                        $(this).children('.info-btn').show().one("click",
                            (!!backBtn&&!!backBtn.onclick&&typeof backBtn.onclick == "function")?
                                backBtn.onclick:
                                function(){
                                    _hideProccessBox(150);
                                }
                        );
                        $(this).children('.confirm-btn').hide();
                        if(opts.dialog.isProcessingShown){
                            _simpleProccessBox2Detail(this);
                        }else{
                            $(this).show();
                        }
                    }else{
                        $(this).hide();
                    }
                }
            });
            if(!opts.dialog.isProcessingShown){
                _showProccessBox();
            }
            if(success){
                //这里有延迟，我们立即把标志位调整为false，为了不影响后面的show。
                opts.dialog.infoTimeoutID = setTimeout(_hideProccessBox,opts.dialog.successInfoLast);
            }
        },

        confirm : function(title,text,confirmText,backText){
            if(!title) title="请确认:";
            if(!text) text="是否执行此操作?";
            if(!confirmText) confirmText=" 确 定 ";
            if(!backText) backText=" 取 消 ";
            var deferred = $.Deferred();
            var isDetailBox = false;
            if(opts.dialog.isProcessingShown){
                if(opts.dialog.$processing.hasClass("success")||opts.dialog.$processing.hasClass("fail")){
                    isDetailBox = true;
                }else{
                    opts.dialog.$processing.addClass("confirm");
                }
            }else{
                opts.dialog.$processing.addClass("confirm");
            }
            opts.dialog.$processing.children().each(function(){
                if($(this).is('.simple-info')) {
                    $(this).children().each(function () {
                        if ($(this).is('img')) {
                            $(this).hide();
                        } else if ($(this).is('span')) {
                            $(this).html(title);
                        } else if ($(this).is('svg')) {
                            if(!isDetailBox){
                                $(this).children('path').attr('d', opts.dialog.confirmSVGPath);
                                $(this).show();
                            }
                        }
                    })
                }else{
                    $(this).children('.info-msg').html(text);
                    $(this).children('.info-btn').hide();
                    $(this).children(".confirm-btn").show().children().each(function(){
                        if($(this).is(".confirm-ok")){
                            $(this).html(confirmText).one('click.zui',function(){
                                //confirm以后往往要接服务器操作，如confirm后->processing，这里没办法阻止前一次的transition
                                //但是整体效果不受太大影响。
                                _hideProccessBox();
                                deferred.resolve();
                            });
                        }else{
                            $(this).html(backText).one('click.zui',function(){
                                _hideProccessBox(150);
                                deferred.reject();
                            });
                        }
                    });
                    if(!isDetailBox&&opts.dialog.isProcessingShown){
                        _simpleProccessBox2Detail(this);
                    }else{
                        $(this).show();
                    }
                 }
            });
            //如果没有显示，或者点用了延迟显示
            if(!opts.dialog.isProcessingShown||opts.dialog.infoTimeoutID!=-1){
                _showProccessBox();
            }
            return deferred;
        },

        success : function(title,text){
            this.processed(true,title,text);
        },

        warn : function(title,text){
            this.processed(null,title,text);
        },

        error: function(title,text){
            this.processed(false,title,text);
        },
        
        logout : function(){
            location.href = "/logout";
        },

        /**
         * 用给出的路径组装绝对路径
         * logicPath如果开头不是/ 认为是相对路径 返回/frame/module/{logicPath}
         * 返回值 = /framePath/modulePath/logicPath中过滤掉前两部分的内容
         * @param path
         */
        buildPath : function(path){
            //过滤logicPath含有admin的情况 /admin/xxx->//xxx  admin/xxx->/xxx
            // var reg = new RegExp("(^(\/*)"+opts.path.frame);
            path = path.replace(opts.path.frame,"");
            //如果url中包含多个/// 替换为一个
            path = path.replace(/(^(\/)+)/,"/");
            if(path.charAt(0) === '/'){
                return "/"+opts.path.frame+path;
            }else{
                return "/"+opts.path.frame+"/"+opts.path.module+"/"+path;
            }
        },

        /**
         * 存入list中，可以支持后退前进按钮
         * 存入的url必须满足格式 /admin/module/xxx
         * @param url 存入的url
         * @param data 与url相对应的数据
         * @param isReplace 是否需要替换或者是增加 默认是false->新增
         */
        pushInHistory : function(url,data,isReplace){
            var lastState,state;
            if(opts.support.history){
                lastState = window.history.state;
                if(lastState&&lastState.url === url && _isDataEqual(lastState.data,data)){
                    //重复记录 目前不做任何操作。
                }else{
                    state =({
                        id: lastState?lastState.id+1:0,
                        url : url,
                        data : data
                    });
                    if(isReplace){
                        window.history.replaceState(state, "", url);
                    }else{
                        window.history.pushState(state, "", url);
                    }
                }
            }else{
                lastState = opts.history.top();
                var hash = _exactHash(url);
                if(lastState&&lastState.url===hash&& _isDataEqual(lastState.data,data)){
                    //重复记录 目前不做任何操作。
                }else{
                    state =({
                        id: lastState?lastState.id+1:0,
                        url : hash,
                        data : data,
                    });
                    opts.history.push(state);
                    if(!isReplace){
                        window.location.hash = hash;
                    }
                }
            }
        },

        _showMainPage : function(html, url, data, inHistory){
            // opts.main.$panel.empty().html(html);
            opts.main.$panel.html(html);
            if(typeof inHistory === "undefined") inHistory = true;
            if(inHistory){
                this.pushInHistory(url,data)
            }
            this.updateLocation(url);
        },

        /**
         * 根据传入的url，找到对应的menu对象，输出其名称到locationpanel
         * @param url
         */
        updateLocation : function(url){
            var menu = _getMenuObject(url);
            if(!!menu){
                opts.location.$panel.empty();
                if(!!menu.topName){
                    opts.location.$panel.append($("<li>"+menu.topName+"</li>"))
                }
                if(!!menu.subName){
                    opts.location.$panel.append($("<li>"+menu.subName+"</li>"))
                }
            }
        },

        /**
         *  将一个集合（或者单个对象）转换成以逗号（或自定义字符）分割的字符串
         *  因为zui-form定义的规则是，如果表单含有一个对象数组，就会选取对象的一个属性（一般是id） 输出成逗号分隔字符串。
         *  这里为了和ZUI-FORM保持同步，后台交互方便，提供这个方法
         *  @param {Object} list - 包干对象的集合或者单个对象
         *  @param {string} attr - 需要转换的对象属性
         *  @param {string} separator - 自定义的分隔符，不填默认使用逗号
         */
        listPropertyString : function(list, attr, separator){
            var result = [];
            if($.isPlainObject(list)){
                return list[attr];
            }else if($.type(list) === 'array'||$.type(list) === 'object'){
                $.each(list,function(index,item){
                    if($.type(item) === 'object'){
                        result.push(item[attr]);
                    }else{
                        result.push(item);
                    }
                });
                separator = separator?separator:',';
                return result.join(separator);
            }else{
                console.error("First parameter is not an array");
            }
        },

        buildTab : function($tabContainer,selected){
            return new ZUITabs($tabContainer,selected);
        },

        /**
         * js截取字符串，中英文都能用
         * @param str：需要截取的字符串
         * @param len: 需要截取的长度
         */
        textCut : function(str,len) {
            if(this.isEmptyStr(str)) return "";
            if(len===undefined||len<=0) return str;
            var str_length = 0,
                str_cut = new String(),
                str_len = str.length;
            for(var i = 0; i < str_len; i++)
            {
                var a = str.charAt(i);
                str_length++;
                if(escape(a).length > 4)
                {
                    //中文字符的长度经编码之后大于4
                    str_length++;
                }
                str_cut = str_cut.concat(a);
                if(str_length>=len)
                {
                    str_cut = str_cut.concat("...");
                    return str_cut;
                }
            }
            //如果给定字符串小于指定长度，则返回源字符串；
            if(str_length < len){
                return  str;
            }
        }
    };

    /**
     * 整体结构
     * <div id=tabContainer>
     *     ...
     *     <div class=tab-header>
     *          -可选 <div class=header-query></div>
     *          <div class=tabs>
     *              <li></li>
     *              ...
     *              ...
     *          </div>
     *      </div>
     *      ...
     *       ...
     *         <!--tab-body只要求包含在tabContainer即可-可以是嵌套在其他div中-->
     *         <div class=tab-body>
     *             ...
     *               ...
     *                 <div class=tab-content></div>
     *               ...
     *             ...
     *         </div>
     *          ...
     *        ...
     * <div>
     * @param $tabContainer
     * @constructor
     */
    var ZUITabs = function($tabContainer,selected){
        this.$container = $tabContainer;
        this.$body = $tabContainer.find('.tab-body');
        this.postSwitchListener = null;
        var $contents = this.$body.find(".tab-content");
        if(!$contents||$contents.size()<1){
            console.warn('ZUITabs must have more than one element with class="tab-content"!');
            return;
        }
        this.$header = $tabContainer.children('.tab-header');
        var $tabs = this.$header.children(".tabs").children("li:not(.notab)");
        if(!$tabs||$tabs.size()<1){
            console.warn('ZUITabs must have more than one li inside the element with class="tabs"!');
            return;
        }
        this.$body.outerHeight($tabContainer.height()-this.$header.outerHeight()-10);
        if(this.$body.parent().is(".form-body")){
            this.$body.parent().height(this.$body.height());
            this.$body.height("100%");
        }
        this.tabs = {};
        var that = this;
        //根据content的数量划分每一个content的单位长度
        var contentLength = $contents.size();
        //ie8 fallback--IE8不支持父容器200%，其他容器100%的百分比写法。这里用特定数值做向下兼容
        if(opts.browser.isIE&&opts.browser.ieVersion===8){
            var widthPerContent = this.$body.width();
            $contents.outerWidth(widthPerContent);
            this.$body.width(widthPerContent*contentLength).transition({ opacity: 1 });
            this.contentStep = widthPerContent;
        }else{
            this.$body.width(contentLength*100+"%").transition({ opacity: 1 });
            this.contentStep = 100/contentLength;
        }

        //注册tab事件
        this.$header.on("click.zui",'li',function(e){
            e.preventDefault();
            that.goto($(this));
        });

        //拼接tabs对象和shown对象
        //默认tab数量可以多于content，反之不行。即好几个tab可用共用一个content。这是content的name有多个值，用逗号分隔 如name="a,b"
        this.current = {};
        $.each($tabs,function(index){
            var tabName = $(this).attr("name");
            if(zui.isEmptyStr(tabName)){
                tabName = index+"";
            }
            that.tabs[tabName] = {
                index : index,
                $tab : $(this),
                name : tabName
            };
            if(index==0){
                that.current = that.tabs[tabName];
            }
        });
        $.each($contents,function(index){
            var contentName = $(this).attr("name");
            if(zui.isEmptyStr(contentName)){
                contentName = index+"";
            }
            var contentNamesList = contentName.split(",");
            for(var i = 0 ;i<contentNamesList.length;i++){
                var name = contentNamesList[i];
                if(that.tabs[name]!==undefined){
                    that.tabs[name].$content = $(this);
                }
            }
        });
        //初始化选定
        if(!!selected){
            var selectedTab = that.getTab(selected);
            if(selectedTab!=null){
                that.goto(selectedTab,false);
            }
        }
    };

    ZUITabs.prototype = {
        /**
         * 根据参数跳转
         * 根据参数将合适的content显示到tab-body中
         * @param name {string|number|JQuery|Object}
         * String - 元素对应的name属性
         * number - LI元素序号，从零开始
         * JQuery - 代表目标元素的tab-content对象
         * object - 代表tab-content的内部tabs对象
         * @param fx -是否动画效果，默认是true
         */
        goto : function(name,fx){
            if(fx === undefined) fx = true;
            var tab = this.getTab(name);
            if(tab!==null && tab !== this.current){
                //switch content
                if(!!this.current.$content && !this.current.$content.is(tab.$content)){
                    var transProp;
                    if(opts.support.transition) {
                        //IE8降级处理
                        transProp = {x: -(tab.index) * this.contentStep+"%"};
                    }else{
                        transProp = {"marginLeft": -(tab.index) * this.contentStep};
                    }
                    if (zui.fx && fx) {
                        this.$body.transition(transProp, '500', opts.fxEasing);
                    } else {
                        this.$body.css(transProp);
                    }
                }
                //switch tab
                if(!this.current.$tab.is(tab.$tab)){
                    tab.$tab.addClass("selected").siblings(".selected").removeClass("selected");
                }
                // replace current
               this.current = tab;
               this.$container.trigger("switchTab.zui",this.current);
               if(this.postSwitchListener!==null){
                   this.postSwitchListener(this.current);
               }
            }
        },

        getTab : function(name){
            var tab = null;
            if($.type(name) === "string") {
                if(this.current.name === name){
                    tab = this.current;
                }else{
                    if(this.tabs[name] !== undefined){
                        tab = this.tabs[name];
                    }
                }
            }else if($.type(name) === 'object'){
                if(zui.isJQDom(name)){
                    if(this.current.$tab.is(name)||this.current.$content.is(name)){
                        tab = this.current;
                    }else{
                        $.each(this.tabs,function(key,value){
                            if(name.is(value.$tab)||name.is(value.$content)){
                                tab = value;
                                return false;
                            }
                        });
                    }
                }else{
                    if(name === this.current){
                        tab = this.current;
                    }
                    tab = name;
                }
            }else if($.type(name) === 'number'){
                if(this.current.index === name){
                    tab = this.current;
                }
                $.each(this.tabs,function(key,value){
                    if(value.index === name){
                        tab = value;
                        return false;
                    }
                });
            }
            return tab;
        },

        showTab : function(name){
            var tab = this.getTab(name);
            if(!!tab && zui.isJQDom(tab.$tab)){
                tab.$tab.show();
            }
        },

        hideTab : function(name){
            var tab = this.getTab(name);
            if(!!tab && zui.isJQDom(tab.$tab)){
                tab.$tab.hide();
            }
        },

        /**
         * 获取当前显示的tab
         * @param name 要获取的属性
         * null or undefined - 获取整个currentTab对象
         * String - 获取currentTab[name]属性
         */
        getCurrent : function(name){
            if(zui.isEmptyStr(name)){
                return this.current;
            }else{
                return this.current[name];
            }
        },

        postSwitch : function(func){
            if($.isFunction(func)){
                this.postSwitchListener = func;
            }
        }
    };

    var ZUIHistory = function(){};

    ZUIHistory.prototype = {
        constructor : ZUIHistory,
        stateStack : [],
        cursor : 0,
        jump : 0,
        push : function(historyData){
            var deleteCount = this.stateStack.length-1-this.cursor;
            if(deleteCount<0) deleteCount=0;
            this.stateStack.splice(this.cursor+1,deleteCount,historyData);
            this.cursor = this.stateStack.length-1;
            this.jump = 0;
        },
        top : function(){
            return this.stateStack[this.cursor];
        },
        backOrForward : function(currentHash){
            var fhit = false,bhit = false;
            // 查看当前游标的上一个或者下一个元素是不是目标，从而判断他是点了前进还是后退。
            // 如果正反都匹配默认当做他是点了前进，去下一个
            if(this.cursor<this.stateStack.length-1&&this.stateStack[this.cursor+1].url===currentHash){
                this.jump=1;
                this.cursor = this.cursor+1;
                return this.stateStack[this.cursor];
            }else if(this.cursor>0&&this.stateStack[this.cursor-1].url===currentHash){
                this.jump=-1;
                this.cursor = this.cursor-1;
                return this.stateStack[this.cursor];
            } else{
                console.warn("target url is not match with history stack!");
                return null;
            }
        },
        isBrowserJump : function(currentHash){
            return this.stateStack[this.cursor].url!==currentHash;
        }
    };

    /**************private funcion********************/

    function _hideProccessBox(speed){
        opts.dialog.isProcessingShown = false;
        opts.dialog.$mask.css('transition', 'inherit').transition({ opacity: 0}, speed?speed:350, 'linear', function(){
                //这个操作是有延迟的，所以当第一次触发，紧接着第二次又显示，那么前一次结束后就会隐藏div，造成第二次显示的时间不够。
                //这里加入判断 只有在isProcessingShown为false的情况下 才会执行隐藏操作，因为isProcessingShown设置不会受延迟干扰
                if(!opts.dialog.isProcessingShown){
                    opts.dialog.$mask.hide().css('opacity',"");
                    opts.dialog.$processing.hide();
                }
        });
    }

    function _showProccessBox(){
        if(opts.dialog.infoTimeoutID!=-1){
            clearTimeout(opts.dialog.infoTimeoutID);
            opts.dialog.infoTimeoutID = -1;
        }
        opts.dialog.$mask.show();
        opts.dialog.$processing.show();
        opts.dialog.isProcessingShown = true;
    }

    function _simpleProccessBox2Detail(container){
        $(container).show();
        var reasonBoxHeight = $(container).height();
        var reasonBoxWidth = $(container).width()+1;
        // console.log($(container).width()+" "+$(container).innerWidth()+" "+$(container).outerWidth());
        $(container).height(0).width(0).css('opacity',0);
        $(container).transition({height:reasonBoxHeight,width:reasonBoxWidth,opacity:1},500,opts.fxEasing,$.proxy(function(){
            this.css('height','').css('width','');
        },$(container)));
    }

    function _buildMenuHtml(menujson){
        if(menujson.length==0){
            throw("载入菜单数据无效！");
            return;
        }else{
            var top_divider = '<li class="vdivider"></li>';
            var topMenuHtml = [];
            $.each(menujson,function(index,top_elem){
                //top menu item html like:'<li><a href="1.html"><i class="fa  fa-truck fa-lg"></i>采购管理</a></li>'
                topMenuHtml[index] = top_divider+'<li><a id="topMenu-'+top_elem.id+'" href="'+top_elem.uri+'"><i class="fa fa-lg '+top_elem.icon+'"></i>'+top_elem.name+'</a></li>';
                var subMenus = top_elem.subMenus;
                if(subMenus!=null){
                    //有菜单,继续构造子菜单
                    var subMenuHtml = [];
                    $.each(subMenus,function(index,sub_elem){
                        if(sub_elem.subMenus==null){
                            //没有子菜单，就把当前项当做直接访问菜单项。
                            subMenuHtml[index] = '<a id="subMenu-'+sub_elem.id+'" href="'+sub_elem.uri+'" title="'+sub_elem.name+'" class="list-group-item"><i class="fa-left-panel-icon '+sub_elem.icon+'"></i><span class="list-text">'+sub_elem.name+'</span></a>';
                            _filllMenuIndex(sub_elem.uri,top_elem.id,sub_elem.id,top_elem.name,sub_elem.name);
                        }else{
                            //有子菜单项，把当前做一个分类表示，再遍历其子菜单，得到可以访问的菜单项。
                            var tempSubMenuHtml = [];
                            tempSubMenuHtml[0] = '<div class="list-divider">'+sub_elem.name+'</div>';
                            $.each(sub_elem.subMenus,function(index,elem){
                                tempSubMenuHtml[index+1] = '<a id="subMenu-'+elem.id+'" href="'+elem.uri+'" title="'+elem.name+'" class="list-group-item" ><i class="fa-left-panel-icon '+elem.icon+'"></i><span class="list-text">'+elem.name+'</span></a>';
                                //缓存index到menu的数组
                                _filllMenuIndex(elem.uri,top_elem.id,elem.id,top_elem.name,elem.name);
                            });
                            subMenuHtml[index] = tempSubMenuHtml.join('');
                        }
                        if(top_elem.uri&&top_elem.uri!=""){
                            // 如果顶级菜单有直接对应的展示页面,也要缓存
                            _filllMenuIndex(top_elem.uri,top_elem.id,null,top_elem.name,null);
                        }
                    });
                    var menuGroupID = "menuGroup-"+top_elem.id;
                    var subMenuGroupHtml =  '<div id="'+menuGroupID+'" class="list-group">'+subMenuHtml.join('')+' </div>' ;
                    opts.left.menuGroupCollapsed[menuGroupID] = false;
                    opts.left.$menuPanel.append(subMenuGroupHtml);
                }
            });
            opts.top.$menuPanel.append(topMenuHtml.join('')+top_divider);
            //加入红色条
            opts.top.$menuSlider = $('<div class="Znavi_slider"/>');
            opts.top.$menuPanel.append(opts.top.$menuSlider);
        }
    }

    /**
     * 私有方法，根据传入的url和top菜单项id，sub菜单项id填充内部对象：opts.path.menuIndex
     * 其中url是key value是{top：top-menu-id,sub:sub-menu-id}
     * @param index {string} 点击该餐单对应的url，也是menuIndex保存的key值
     * @param top 该url对应的top菜单项ID
     * @param sub 该url对应的sub菜单项ID
     * @private
     */
    function _filllMenuIndex(index,top,sub,topName,subName){
        if(zui.isEmptyStr(index)) return;
        opts.path.menuIndex[index] = {
            top : top,
            sub : sub,
            topName : topName,
            subName : subName,
        };
    }

    /**
     * 根据传来的参数解析出path的各个部分
     * 如：
     * http://localhost:8080/admin/category/xxx
     * window.location.pathname -> /admin/category/xxx
     * 传来的是category 根据他分隔
     * 前面的部分是 opts.data.frame -> admin
     * 中间的部分是 opts.data.module -> category
     * 后面的部分是 opts.data.item -> xxx
     * @param actualPageUrl
     * @private
     */
    function _parsePath(actualPageUrl){
        var httpPath = window.location.pathname;
        httpPath = httpPath.replace(/^(\/)|\.(\w+?)$|;(.*)$/g,"");//去除字符串首位的"/"、扩展名、还附加的;jsessionid
        // window.location.replace(window.location.protocol+location.hostname+":"+location.port+"/"+httpPath);
        var pathArray = httpPath.split("/");
        var tempFramePath = pathArray[0];
        var itemPath = [];
        var frameOver = false;
        var actualModelName;
        if(actualPageUrl==="error/404"){
            frameOver = true;
            actualModelName = null;
        }else{
            actualModelName = actualPageUrl.split("-")[0];
        }
        for(var i = 1 ;i<pathArray.length;i++){
            var path = pathArray[i];
            if(path === "index" || path === actualModelName){
                frameOver = true;
            }
            if(!frameOver){
                tempFramePath+="/"+path;
            }else{
                if(path !== "index" && path !== actualModelName){
                    itemPath.unshift(path);
                }
            }
        }
        opts.path.frame = tempFramePath;
        opts.path.module = $.isEmptyObject(actualPageUrl)?null:actualPageUrl;
        opts.path.items = itemPath;
        opts.path.stripFrameReg =  new RegExp(".*("+opts.path.frame+"\\\/)+");
    }

    /**
     * @Deparated
     * 内部调用ajax（communicate，loadPath），根据传来的url来组成真实访问的url
     * 传来的url格式为：module/（itemA）/(itemB)/...
     * @param path module/（itemA）/(itemB)/...
     * @param isSilence 静默。只组装url串不记录。
     * @private
     */
    function _D_buildPath(path,isSilence){
        path = path.replace(/^(\/)|\.(\w+"?)$/g,"");//去除字符串收尾的"/"和扩展名
        if(isSilence){
            return "/"+opts.path.frame+"/"+path;
        }
        var pathArray = path.split("/");
        if(pathArray.length === 0) throw error("AJAX PATH不能为空");
        var modulePath =  pathArray.shift();
        opts.path.isPageChanged = opts.path.module !== modulePath;
        if(opts.path.isPageChanged){
            opts.path.module = modulePath;
        }else{
            //模块相同的情况下。新地址比等于原地址或者少一段。说明是是retreive操作。用communicate而不是loadPage.
            opts.path.isPageChanged = pathArray.length == opts.path.items.length||pathArray.length+1 == opts.path.items.length
        }
        opts.path.items = pathArray;
        return "/"+opts.path.frame+"/"+opts.path.module
                    +(opts.path.items.length>0?"/"+opts.path.items.join("/"):"");
    }

    function _initTop(){
        //**辅助显示
        var $menuItem = opts.top.$menuPanel.find("li:has(a)");
        var selectedTopMenuItem = $menuItem.eq(opts.default_top_index);
        opts.top.$selectedMenuItem = selectedTopMenuItem.addClass("active");
        opts.top.$menuSlider.css({
            "left": opts.top.$selectedMenuItem.position().left + "px",
            "width": opts.top.$selectedMenuItem.outerWidth() + "px",
            "top": opts.top.$selectedMenuItem.outerHeight() - 5 + "px"
        });
        opts.left.$selectedSubMenuGroup = _get$MenuGroupByTopMenuItem(selectedTopMenuItem);
        opts.left.$selectedSubMenuGroup.show().siblings().hide();


        //**绑定事件
        //1注册hover事件
        //mouseover，mouseleave 会冒泡.mouseenter，mouseout 不会.
        // 注意会不会有重复进入的bug？
        opts.top.$menuPanel.on('mouseenter.ZUI','li:has(a)',
            {type:'in'},_moveTopSlider);
        //焦点移走了，红条跳回到selected元素上。
        opts.top.$menuPanel.on('mouseleave.ZUI','li:has(a)',
            {type:'out'},_moveTopSlider);

        //2注册click事件
        opts.top.$menuPanel.on("click.ZUI",'li:has(a)',function(e){
            e.preventDefault();
            _toggleSubMenu(_get$MenuGroupByTopMenuItem($(this)));
            _adjustSelected('top',$(this));
            var link = $(this).children("a").attr("href");
            if(!zui.isEmptyStr(link)){
                opts.path.module = link;
                zui.loadPage("/"+link);
            }
        })
    }

    function _initLeft(zui){
        //注册事件
        opts.left.$panel.height($(window).height()-$(".navbar-zface").height()-5);
        //1.绑定收缩
        opts.left.$arrow.click(_collapse);
        //2.绑定点击
        opts.left.$menuPanel.on("click.ZUI","a.list-group-item",function(e){
            e.preventDefault();
            var link = $(this).attr('href');
            if(!zui.isEmptyStr(link)) {
                opts.path.module = link;
                zui.loadPage("/"+link);
                _adjustSelected('left',$(this));
            }
        });
    }

    function _initMain(){
        opts.main.$panel.height($(window).height()-$(".navbar-zface").height()-opts.location.$panel.parent(".location-panel").outerHeight()-2);
        // console.log($(window).height()+" "+opts.top.$menuPanel.outerHeight()+"  "+opts.location.$panel.parent(".location-panel").outerHeight());
    }


    function _toggleSubMenu($menuGroup){
        if($menuGroup!=opts.left.$selectedMenuItem){
            opts.left.$selectedSubMenuGroup.hide();
            opts.left.$selectedSubMenuGroup = $menuGroup.show();
            _collpaseLeftMenu(opts.left.isCollapsed);
        }
    }


    function _moveTopSlider(e){
        var $source,$target;
        if(e.data.type === 'in'){
            $source =  opts.top.$menuSlider;
            $target = $(e.currentTarget);
        }else{
            $source = opts.top.$menuSlider;
            $target = opts.top.$selectedMenuItem;
        }
        if ($source instanceof jQuery && $target instanceof jQuery) {
            $source.stop().transition({
                left: $target.position().left + "px", width: $target.outerWidth() + "px"
            }, 300,'linear'/*'linear'*/);
        }
    }


    function _collpaseLeftMenu(collapsed){
        // 如果需要的状态和实际状态不相同进行调整
        if(collapsed!=opts.left.menuGroupCollapsed[opts.left.$selectedSubMenuGroup.attr("id")]){
            if(collapsed){
                //调整菜单项文字
                opts.left.$selectedSubMenuGroup.children("a").each(function () {
                    $(this).children("span.list-text").hide();
                    //adjust badget
                    $(this).children("span.badge").addClass("badge-sm");
                    // 消除下边线
                    $(this).addClass("collapsed");
                });
                //调整菜单分隔项
                opts.left.$selectedSubMenuGroup.children("div.list-divider").each(function (index) {
                    if (index == 0) {
                        //显示第一个divider。
                        $(this).hide();
                    } else {
                        //恢复原始文字的padding
                        $(this).addClass("collapsed");
                    }
                });
            }else{
                opts.left.$selectedSubMenuGroup.children("a").each(function () {
                    //show html text.
                    $(this).children("span.list-text").show();
                    //adjust badget
                    $(this).children("span.badge").removeClass("badge-sm");
                    // 恢复下边线
                    $(this).removeClass("collapsed");
                });
                //调整菜单分隔项
                opts.left.$selectedSubMenuGroup.children("div.list-divider").each(function (index) {
                    if (index == 0) {
                        //显示第一个divider。
                        $(this).show();
                    } else {
                        //恢复原始文字的padding
                        $(this).removeClass("collapsed");
                    }
                });
            }
            opts.left.menuGroupCollapsed[opts.left.$selectedSubMenuGroup.attr("id")] = collapsed;
        }
    }

    function _collpaseLeftIcons(collapsed){
        if(collapsed!=opts.left.isCollapsed){
            if(collapsed){
                //--收缩
                //adjust arrow direction
                opts.left.$arrow.addClass("fa-rotate-180");
                //adjust avator panel.
                opts.left.$panel.find("div.avator").addClass("avator-sm");
                //adjust welcome panel.
                opts.left.$panel.find("div.welcome").addClass("welcome-sm").children("span").hide();
                //adjust version panel.
                opts.left.$version.addClass("collapsed");
                //adjust the main panel
                opts.main.$panel.css("marginLeft", opts.left.collapseWith);
            }else{
                //--展开
                //adjust arrow direction
                opts.left.$arrow.removeClass("fa-rotate-180");
                //adjust avator panel.
                opts.left.$panel.find("div.avator").removeClass("avator-sm");
                //adjust welcome panel.
                opts.left.$panel.find("div.welcome").removeClass("welcome-sm").children("span").show();
                //adjust version panel.
                opts.left.$version.removeClass("collapsed");
                //adjust the main pane
                opts.main.$panel.css("marginLeft", opts.left.uncollapseWith);
            }
            opts.left.isCollapsed  =  collapsed;
        }
    }

    function _collapse(e){
        var collapse = !opts.left.isCollapsed;
        var width;
        if(collapse){
            width = opts.left.collapseWith;
            opts.left.$panel.stop().transition({width: width}, 200, _adjustLeftPanel(collapse));
        }else{
            width = opts.left.uncollapseWith;
            opts.left.$panel.stop().transition({width: width}, 200, _adjustLeftPanel(collapse));
        }

    }

    function _adjustLeftPanel(collapse){
        _collpaseLeftIcons(collapse);
        _collpaseLeftMenu(collapse);
    }

    function _2SimpleID(compositeID){
        var idArray = compositeID.split('-');
        if(idArray.length>1){
            return compositeID.split('-')[1];
        }else{
            return compositeID.split('-')[0];
        }
    }

    function _getSimpleIDByTopMenuItem($menuItem){
        var $item = null;
        if($menuItem.is('li')){
            $item = $menuItem.children("a");
        }else{
            $item = $menuItem;
        }
        var complexID = $item.attr("id");
        return _2SimpleID(complexID);
    }

    function _get$TopMenuItemBySimpleID(id){
        return  $('#topMenu-'+id,opts.top.$menuPanel);
    }

    function _get$SubMenuItemBySimpleID(id){
        return  $('#subMenu-'+id,opts.left.$menuPanel);
    }

    function _get$MenuGroupByTopMenuItem(menuItem){
        if(menuItem instanceof jQuery){
            return $('#menuGroup-'+_getSimpleIDByTopMenuItem(menuItem),opts.left.$menuPanel);
        }else if($.type(menuItem) === 'string'){
            return $('#menuGroup-'+_2SimpleID(menuItem),opts.left.$menuPanel);
        }else{
            return error("can not handle type of menuItem");
        }
    }





    function _adjustSelected(type,$currentItem){
        var $selectedItem;
        $selectedItem = opts[type].$selectedMenuItem;
        opts[type].$selectedMenuItem = $currentItem;
        if($.isEmptyObject($currentItem)){
            if($selectedItem!=null){
                $selectedItem.removeClass("active");
            }
        }else if(!$currentItem.is($selectedItem)){
            $currentItem.addClass("active");
            if($selectedItem!=null){
                $selectedItem.removeClass("active");
            }
            return true;
        }
        return false;
    }

    function _initHistory(zui){
        if(opts.support.history){
            window.onpopstate = function(e){
                var curState = e.state;
                if(curState){
                    opts.path.module = curState.url.split("/")[2];
                    zui.loadPage(curState.url,curState.data,false);
                    _adjustMenuIndex(curState.url)
                }
            };
        }else{
            opts.history = new ZUIHistory();
            $(window).on("hashchange",function(){
                var curHash = _exactHash(window.location.hash);
                if(opts.history.isBrowserJump(curHash)){
                    /*opts.path.module = curState.url.split("/")[2];
                    zui.loadPage(curState.url,curState.data,false);
                    _adjustMenuIndex(curState.url)*/
                    var his = opts.history.backOrForward(curHash);
                    var url,data;
                    if(!!his){
                        url = "/"+opts.path.frame+his.url;
                        console.info((opts.history.jump>0?"forward:":"back:")+url);
                        data = his.data;

                    }else{
                        url = window.location.pathname;
                        console.info("not recored in history,just jump (without data):"+url);
                        data = null;
                    }
                   opts.path.module = url.split("/")[1];
                    zui.loadPage(url,data,false);
                    _adjustMenuIndex(url)
                }
            });
        }
    }

    function _adjustMenuIndex(url){
       /* if(!url) return;
        var url = url.replace("/admin/",""),
            indexURL = url.split("/"),
            menuKey = indexURL[0]==="index"?"mine":indexURL[0],
            menuIndex = opts.path.menuIndex[menuKey];*/
        var menuIndex = _getMenuObject(url);
        if(menuIndex){
            if(menuIndex.top){
                _toggleSubMenu(_get$MenuGroupByTopMenuItem(menuIndex.top));
                var topSelectedItem = _get$TopMenuItemBySimpleID(menuIndex.top).parent();
                if(_adjustSelected('top',topSelectedItem)){
                    _moveTopSlider({data:{type:'in'},currentTarget:topSelectedItem});
                }
            }
            if(menuIndex.sub){
                _adjustSelected('left',_get$SubMenuItemBySimpleID(menuIndex.sub));
            }else{
                _adjustSelected('left',null);
            }
        }
    }


    function _getMenuObject(url){
        if(!url) return null;
        var path = url.replace("/"+opts.path.frame+"/",""),
            paths = path.split("/"),
            menuKey = paths[0]==="index"?"mine":paths[0];
        return opts.path.menuIndex[menuKey];

    }

    function _initInfoBox(zui){
        // opts.dialog.$loadingBox.hide();
    }

    function _expose(zui){
        zui.initialized = true;
        zui.fx = opts.fx;
        zui.basePath = "/"+opts.path.frame+"/";
        zui.timeout = opts.trans.ajaxTimeout;
        zui.$mainPanel = opts.main.$panel;
        zui.$masker = opts.dialog.$mask;
    }

     function _exactHash( url ) {
            var hash = url.replace(/^[^#]*#/, '')/* strip anything before the first anchor */
                            .replace(/^#+|#+$/, '')/*strip # tail*/
                            .replace(opts.path.stripFrameReg,"/");/*strip before frame part*/
            return hash;
    }

    function _isDataEqual(source,target){
        if(source===target) return true;
        for( var p in source){
            if(!target.hasOwnProperty(p)){
                return false;
            }else if(source[p]!==target[p]){
                return false;
            }
        }
        for(var j in target){
            if(!source.hasOwnProperty(p)){
                return false;
            }
        }
        return true;
    }

    /**
     * 检测浏览器返回 browser 对象
     * @returns {{}}
     * @private
     */
    function _browserCheck(){
        var browser = {};
        var userAgent = navigator.userAgent; //取得浏览器的userAgent字符串
        browser.isOpera = userAgent.indexOf("Opera") > -1; //判断是否Opera浏览器
        browser.isChrome = userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Safari") > -1; //判断Chrome浏览器
        browser.isIE = userAgent.indexOf("compatible") > -1 && userAgent.indexOf("MSIE") > -1 && !(browser.isOpera); //判断是否IE浏览器
        browser.isEdge = userAgent.indexOf("Windows NT 6.1; Trident/7.0;") > -1 && !isIE; //判断是否IE的Edge浏览器
        browser.isFF = userAgent.indexOf("Firefox") > -1; //判断是否Firefox浏览器
        browser.isSafari = userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") == -1; //判断是否Safari浏览器
        if(browser.isIE){
            var reIE = new RegExp("MSIE (\\d+\\.\\d+);");
            reIE.test(userAgent);
            browser.ieVersion = parseFloat(RegExp["$1"]);
        }
        return browser;
    }

    //针对浏览器向下支持
    function _fallback(opts){
        //针对提示框用到的animation动画做
        // 用jquery.transaction 替换jquery动画
        if ($.support.transition){
            //如果支持并且有transition，用transition替换animate
            $.fn.animate = $.fn.transition;
        }else{
            opts.support.transition = false;
            //如果没有transition,那么用JQ的animate替换transition。这样能统一API调用
            $.fn.transition = $.fn.animate;
            //zuiFrame默认的动画easing效果是：snap，
            //在没有transition的情况下，默认的jq的easing效果只支持swing和linear。要么引入jqUI 要么降级为那两种
            opts.fxEasing = "swing";
        }
        //针对dialog提示系统降级处理
        if(opts.browser.isIE&&opts.browser.ieVersion<9){
            opts.support.svg = false;
            //opts.fx = false;
            _fallBackDialog(opts);
        }
        //针对ajax记录History做降级处理
        if(window.onpopstate===undefined){
            opts.support.history = false;
        }
        return opts;
    }


    /**
     * 针对不支持SVG动画的浏览器，将SVG动画图标替换成PNG
     * @private
     */
    function _fallBackDialog(opts){
        if(!opts.support.svg){
            var structor = '<div class="fallback-icon"><i></i></div>';
            opts.dialog.$processing.find(".checkmark").after(structor).remove();
            //因为不使用SVG，没必要让成功提示框停留太久
            opts.dialog.successInfoLast = 300;
        }
    }


    //注册到jQuery全局
    // $.extend({
    //     ZUI: function (option) {
    //         var zui = $('body').data("zui");
    //         if (!zui) {
    //             zui = new ZUI(option);
    //             $('body').data('zui', zui);
    //         }
    //         return zui;
    //     }
    // });

    var zui = $('body').data("zui");
    if (!zui) {
        zui = new ZUI();
        $('body').data('zui', zui).data('ZUI',ZUI);
    }
    return zui;
}));