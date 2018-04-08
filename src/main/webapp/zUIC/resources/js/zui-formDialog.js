/**
 * Created by 张未然 on 2016/10/18.
 */

;(function(factory){
    if(typeof define === 'function' && define.amd ){
        //以AMD模式加载，RequireJS中用。
        define(['jquery','zuiFrame','zuiForm'],factory);
    }else if(jQuery){
        //以jQuery引入模式加载。
        factory(jQuery);
    }else{
        throw "Neither AMD nor jQuery is prepared for zuiFrame!";
    }
}(function($,zui){
    var ZUI = $('body').data('ZUI');
    if(!ZUI){
        console.error("Require zuiFrame loaded before invoking！");
        return;
    }
    //如果ZUI中没有这个再执行初始化构造-优化
    if(!ZUI.prototype.makeDialog){

    /* 整体结构如下
     <div class="processing-box" id="topic-confirm" style="display: none;">
        <div class="simple-info">
            <span><img src="${res}/images/参数图标"/></span>
            <span>标题名称</span>
        </div>
        <div class="detail-info">
            <span class="info-msg">
                填充内容
            </span>
            <div class="confirm-btn">
                <span class="confirm-ok"> 确 定 </span>
                <span class="confirm-back"> 返 回 </span>
            </div>
        </div>
     </div>
    */
        /**
         * 创建一个用于内含表单的对话框
         * @param {string\jQuery} title string-对话框标题文字，jQuery-jq对象代表标题的html
         * @param {string\jQuery} content string-对话框内容文字，jQuery-jq对象代表内容html
         * @param communicate {object} {init:xxx,commit:xxx} init用于初始化的URL，commit用于点击确定后的url
         * @param submit {string|object} string-提交按钮的文字 object-{text:提交按钮文字,pre:function(data)|null 提交前退data进行处理,post:function(data)|null 提交后处理}
         * @param cancel {string|object} 参见submit
         * @returns {ZUIFormDialog}
         */
        ZUI.prototype.makeDialog = function(title,content,communicate,submit,cancel){
            var options = buildOptions(title,content,submit,cancel);
            var opts = $.extend(true,{},DialogDefault,options);
            var $dialog = structure(opts);
            var zuiFormDialog = new ZUIFormDialog($dialog,opts,communicate);
            return zuiFormDialog;
        };


        var DialogDefault = {
            title : {
                text : "请确认"
            },
            content : {},
            button : {
                submit : {
                    text : ' 确 定 ',
                    preHandler : null
                },
                cancel : {
                    text : ' 返 回 ',
                    preHandler : null
                }
            },
        };

        function buildOptions(title,content,submit,cancel){
            var opts = {};
            if(zui.isJQDom(title)){
                opts.title = {
                    $dom : title
                };
            }else if(!zui.isEmptyStr(title)){
                opts.title = {
                    text : title
                }
            }

            if(zui.isJQDom(content)){
                opts.content = {
                    $dom : content
                };
            }else if(!zui.isEmptyStr(content)){
                opts.content = content
            }
            opts.button = {};
            if(zui.isJQDom(submit)){
                opts.button.submit = {
                    $dom : submit
                };
            }else if($.type(submit) === "string" &&!zui.isEmptyStr(submit)){
                opts.button.submit = {
                    text : submit
                };
            }else if($.type(submit) === "object" && !$.isEmptyObject(submit)){
                opts.button.submit = submit;
            }

            if(zui.isJQDom(cancel)){
                opts.button.cancel = {
                    $dom : submit
                };
            }else if($.type(cancel) === "string" && !zui.isEmptyStr(cancel)){
                opts.button.cancel = {
                    text : cancel
                };
            }else if($.type(cancel) === "object" && !$.isEmptyObject(cancel)){
                opts.button.cancel = cancel;
            }
            return opts;
        }

        function structure(opts){
            var title = opts.title.$dom;
            if(!title){
                // var icon = opts.title.icon===DialogDefault.title.icon?opts.title.icon:'<span><img src="'+opts.title.icon+'"/></span>';
                title = '<span class="dialog-icon"></span><span>'+opts.title.text+'</span>';
            }else{
                title = title.html();
            }
            var content = opts.content.$dom;
            if(!content){
                content = opts.content;
            }else{
                content = content.detach().html();
            }
            var submit = opts.button.submit.$dom;
            if(!submit){
                submit = '<span class="confirm-ok">'+ opts.button.submit.text +'</span>';
            }else{
                submit = submit.html();
            }
            var cancel = opts.button.cancel.$dom;
            if(!cancel){
                cancel = '<span class="confirm-back">'+ opts.button.cancel.text +'</span>';
            }else{
                cancel = cancel.html();
            }
            var dialogStructure = '<div class="processing-box" style="display: none;">'
                + '<div class="simple-info">' + title + '</div>'
                + '<div class="detail-info">'
                    + '<span class="info-msg">' + content + '</span>'
                    + '<div class="confirm-btn">' + submit + cancel + '</div>'
                + '</div>'
            + '</div>';
            var $dialog = $(dialogStructure);
            zui.$mainPanel.append($dialog);
            return $dialog;
        }


        var ZUIFormDialog = function($dialog,opts,communicate){
            this.$dialog = $dialog;
            this.opts = opts;
            this.$contentPanel = this.$dialog.children(".detail-info").children(".info-msg");
            var $buttons = this.$dialog.children(".detail-info").children(".confirm-btn");
            this.$submitButton = $buttons.children(".confirm-ok");
            this.$cancelButton = $buttons.children(".confirm-back");
            this.form =  zui.buildForm(this.$contentPanel,"dialog","dialogForm");
            this.shown = false;
            this.dfd = $.Deferred();
            if(!!communicate){
                this.commitUrl = (!!communicate.commit)?communicate.commit:null;
                this.initUrl = (!!communicate.init)?communicate.init:null;
            }else{
                this.commitUrl = null;
                this.initUrl = null;
            }
            this._init();
        };

        ZUIFormDialog.prototype = {
            _init : function(){
                var that = this;
                //注册button点击
                this.$submitButton.click(function(e){
                    e.preventDefault();
                    if(that.shown){
                        if($.type(that.opts.button.submit.preHandler) === 'function'){
                            var preResult = that.opts.button.submit.preHandler.call(that);
                            if(preResult===false) return;
                        }
                        var commitResultDeferred = that.form.update(false,null,that.commitUrl);
                        if(commitResultDeferred!==null){
                            commitResultDeferred.done(function(resultData, textStatus, jqXHR){
                                that.hide();
                                that.dfd.resolve(resultData, textStatus, jqXHR);
                            }).fail(function(jqXHR, textStatus, errorThrown){
                                zui.handleTransDataError(jqXHR, textStatus, errorThrown);
                            });
                        }
                    }
                });
                this.$cancelButton.click(function(e){
                    e.preventDefault();
                    if(that.shown){
                        if($.type(that.opts.button.cancel.preHandler) === 'function'){
                            var result = that.opts.button.cancel.preHandler.call(that);
                            if(result===false){
                                return;
                            }
                        }
                        that.hide();
                        that.dfd.reject();
                    }
                });
            },
            /**
             * 判断dialog是不是显示的状态
             */
            isShow : function(){
                return this.shown;
            },
            /**
             * 显示dialog，如果指定参数-data 将用data中的数据给dialog中的field，如果不指定，全部赋予空
             * @param data {object} - 显示dialog时表单的初始值
             */
            show : function(data){
                var that = this;
                if(!!data){
                    this.form.retrieve(data,this.initUrl)
                }else{
                    this.form.resetForm();
                }
                this.dfd = $.Deferred();
                this.$dialog.show();
                this.shown = true;
                zui.$masker.show();
                $(document).one("keydown",that.$dialog,function(e){
                    if(e.keyCode==27&&that.shown){
                        that.hide();
                        $(document).off("keydown");
                    }
                });
                return this.dfd.promise();
            },
            /**
             * 隐藏dialog
             * @param {boolean=} withData true-将dialog中的form数据变成json对象，返回
             *                             false-默认值，只隐藏
             */
            hide : function(withData){
                var data = null;
                if(withData){
                    data = this.getData();
                }
                zui.$masker.hide();
                this.$dialog.hide();
                this.shown = false;
                return data
            },
            /**
             * 获取dialog内含表单组成的JSON对象
             * 根据表单内容返回JSON对象
             * @param {boolean} flat 是否扁平化json对象  默认false(不填就是false)
             *                       说明：针对嵌套数据 如user.name
             *                            如果flat为false 那么生成的就是 {user:{name:{xxx}}}
             *                            如果flat为true 那么生成的就是 {'user.name':xxx}
             */
            getData : function(flat){
                return this.form.getData(flat);
            },
            /**
             * 获取dialog内置的zuiform对象。
             */
            getForm : function(){
                return this.form;
            },
            /**
             * 注册一个前处理器，在点击提交按钮前触发，不接受任何参数，如要获取dialogForm的数据，请用getData或getForm方法
             * 方法返回false 将组织提交
             * @param f
             */
            setPreSubmitHandler : function(f){
                if($.type(f) === "function"){
                    this.opts.button.submit.pre = f;
                }
            },
            /**
             * 注册一个前处理器，在点击取消按钮前触发，不接受任何参数，如要获取dialogForm的数据，请用getData或getForm方法
             * 方法返回false 将组织取消操作
             * @param f
             */
            setPreCancelHandler : function(f){
                if($.type(f) === "function"){
                    this.opts.button.cancel.before = f;
                }
            },
            /**
             * 注册一个用于发送数据的数据转化器
             * func接受一个参数，data-准备发送给服务器的数据
             * 注意：这里的this是form。因为这个是委托给form的sendConverter完成的
             *      方法false将阻止提交
             * @param func
             */
            setSendDataConverter : function(func){
                if($.isFunction(func)){
                    this.form.setSendConverter(func);
                }
            },
            /**
             * 注册一个用于显示表单数据的转化器
             * func接受一个参数，data-从服务器接受的数据
             * 注意：这里的this是form。因为这个是委托给form的sendConverter完成的
             *      方法false将阻止用服务器端数据填充表单
             * @param func
             */
            setShowDataConverter : function(func){
                if($.isFunction(func)){
                    this.form.setRecieveConverter(func);
                }
            }
        };
    }
}));