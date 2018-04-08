;(function(factory){
    if(typeof define === 'function' && define.amd ){
        //以AMD模式加载，RequireJS中用。
        define(['require','jquery','zuiFrame','bvForm','datePicker'],factory);
    }else if(jQuery){
        //以jQuery引入模式加载。
        factory(jQuery);
    }else{
        throw "Neither AMD nor jQuery is prepared for zuiFrame!";
    }
}(function(require,$,zui){
    var ZUI = $('body').data('ZUI');
    if(!ZUI){
        console.error("Require zuiFrame loaded before invoking！")
    }else{
        //执行一次.设置全局属性
        $.extend($.fn.datepicker.defaults,{
            autoclose:true,
            weekStart:1,
            format:'yyyy年mm月dd日',
            clearBtn:true,
            templates : {
                leftArrow: '<i class="fa fa-angle-left"></i>',
                rightArrow: '<i class="fa fa-angle-right"></i>'
            }
        });
        $.fn.datepicker.dates['en'] = {
            days: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
            daysShort: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
            daysMin:  ["日", "一", "二", "三", "四", "五", "六"],
            months: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
            monthsShort: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
            today: "今日",
            clear: "清空",
            format: "yyyy年mm月dd日",
            titleFormat: "yyyy年mm月",
            weekStart: 1
        };
        // CKEDITOR_BASEPATH = '/res/default/plugins/ckeditor/';

        //给zui增加buildForm方法，返回zuiForm实例
        ZUI.prototype.buildForm = function($formContainer,moduleName,formType,$operation,selected){
            if(!this.isJQDom($formContainer)){
                console.warn("specified container is not containing any DOM elements!");
                return;
            }
            var zuiForm;
        //step 1: parameter override
            //判断第四个参数如果为{}对象,转化为selected
            if(!this.isUDF($operation) && !zui.isJQDom($operation)){
                selected = $operation;
                $operation = null;
            }
        //step 2:structure form and register listener if need by formType
            if(!formType||formType === "baseForm"){
                var otherHeight = $formContainer.data("otherHeight");
                otherHeight = otherHeight===undefined?0:otherHeight;
                var $body;
                //重新计算form的高度,保证form顶满且不超过窗口大小
                if($formContainer.has(".form-body")){
                    if($formContainer.is(".form-body")){
                        $body = $formContainer;
                    }else{
                        $body = $formContainer.children(".form-body")
                    }
                    $body.width("100%").addClass("base-form")
                         .outerHeight($formContainer.parent().height()- otherHeight
                        -$formContainer.siblings(".header,.tab-header").outerHeight()
                        -$formContainer.children('.header,.tab-header').outerHeight()-10)
                        .transition({ opacity: 1 });
                        //-10 下面留10px空隙
                }else{
                    console.error(".form-body Not found in building zui-form!");
                    return;
                }
                zuiForm = new ZUIForm(moduleName,"baseForm",$body,null,$operation);
            }else if(formType === "tabForm"){
                var selectedTab;
                if(selected !== undefined&&selected.tab!== undefined){
                    selectedTab = selected.tab;
                }
                var zuiTab = zui.buildTab($formContainer,selectedTab);
                var $body = $formContainer.children('.form-body');
                zuiForm = new ZUIForm(moduleName,formType,$body,zuiTab,$operation);
                $formContainer.on('switchTab.zui',function(e,currentTab){
                    if(currentTab.$tab.is('.content-has-error')){
                        currentTab.$content.addClass('content-has-error');
                    }else{
                        zuiForm.$body.removeClass('content-has-error');
                    }
                });
            }else if(formType === "dialogForm"){
                if(!zui.isJQDom($formContainer.find("form"))){
                    $formContainer.wrapInner("<form></form>");
                }
                zuiForm =  new ZUIForm(moduleName,"baseForm",$formContainer,null,$operation);
            }
            // zuiForm.fetchFieldsDefaultsValue();
            zuiForm.initCurrentItem();
            return zuiForm;
        };

        var ZUIForm = function(moduleName,type,$body,zuiTab,$operation) {
            this.type = type;
            this.$body = $body;
            this.$form = $body.find("form");
            if(!!zuiTab){
                this.zuiTab = zuiTab;
            }
            //代表现在使用的item。永远是一个二维对象
            //如果是嵌套对象，内部将服务器传来的{A：{B：{}}}这种前台关系转换为{A.B:{}}
            this._serverFields = {};
            this.basePath = "/"+moduleName;
            this._nameTo$FieldsMap = {};
            this._name2LabelMap = {};
            this.$editor = null;
            this.defaultThumbPath = "url(/res/default/images/default-thumb.jpg)";
            this.opListener = {};
            this.$operation = zui.isUDF($operation)?this.$form:$operation;
            this.tableHeight = 0;
            this.formDataPropertyName="item";
            this._init();

        };

        function getVal(item,prop){
            var rst = "";
            if($.isPlainObject(item)){
                rst = item[prop];
            }else{
                rst = item;
            }
            return rst.toString();
        };
        
        ZUIForm.prototype = {
            validatorSettings:  {
                excluded : [
                    ':disabled', ':hidden', ':not(:visible)'
                ],
                feedbackIcons : {
                    valid : 'fa fa-check',
                    invalid : 'fa fa-times',
                    validating : 'fa fa-circle-o-notch fa-spin'
                },
                live : 'enabled',
                message : 'This value is not valid',
                submitButtons : 'button[type="submit"]',
                trigger : null,
                verbose : false,
                container:function($filed,validator){
                    return $filed.parents('div.form-group').children('div:last');
                },
            },
            extraValidator : [],
            postFormResetHandler:[],
            _init : function () {
                this.transToDateField();
                this._bindEnterEvent();
                this._bindOpListener();
            },
            transToDateField : function($container){
                if(!zui.isJQDom($container)){
                    $container = this.$form.find("div.input-group.date,div.input-group.input-daterange");
                }
                $container.each(function(){
                    var options = {};
                    //如果是时间段
                    $(this).children("input").each(function(){
                        //如果是生日，初始打开"十年"视图
                        if($(this).attr("name").toLowerCase().indexOf("birth")>=0){
                            options.startView = 2;//等效配置 "years","decade"
                            return false;
                        }else{
                            options.startView = 0;//初始化选择days
                            options.todayBtn = true;//选择框下方出现当前天快速选择
                            options.todayHighlight = true;//高亮显示当前天
                            return false;
                        }
                    });
                    $(this).datepicker(options);
                });
            },
            /**
             * Ajax表单要阻止回车提交事件，改由对应的Save逻辑实现
             * 先找operation=save的button 找不到 找operation=change的。再找不到不做任何处理
             * @private
             */
            _bindEnterEvent : function(){
                this.$form.submit(function(e){
                    e.preventDefault();
                    var $submit = $('.operations>span[data-op=save]');
                    if(zui.isJQDom($submit)){
                        $submit.trigger("click");
                    }else{
                        $submit = $('.operations>span[data-op=change]');
                        if(zui.isJQDom($submit)) {
                            $submit.trigger("click");
                        }
                    }
                });
            },
            /**
             * 在需要的input外面包裹DIV，变成一个图片+隐藏DIV的形式，点击会自动关联CKFinder上传图片
             * <div style="background:xxxx">
             *     <input control>
             * </div>
             * @param field
             * @param fieldValue
             */
            bindThumbnail : function(field,imgHolderCSS){
                var that = this;
                var defaultStyle = {
                    'float':"left",
                    'width':"120px",
                    'height':"120px",
                    'margin-left':"15px",
                    'background-color':"#f5f5f5",
                    'background-repeat':"no-repeat",
                    'background-size':"cover",
                    'background-image':this.defaultThumbPath
                };

                if($.type(field) === "string"){
                    field = that.get$FieldByName(field);
                }else if(zui.isJQDom(field)){
                    //do nothing;
                }else{
                    field = null;
                }
                if(field===null){
                    throw new Error("parameter invalid for bindThumbnail!");
                }
                field.data("thumbnail",true);
                var css = $.extend({},defaultStyle,imgHolderCSS);
                if(css["background-image"]!==defaultStyle["background-image"]) {
                    this.defaultThumbPath = css["background-image"];
                }
                if(!zui.isEmptyStr(field.prop("value"))){
                    css["background-image"] = field.prop("value");
                }
                var $imgHolder = field.wrap("<div></div>").parent("div").css(css);
                require(['ckfinder'],function(){
                    $imgHolder.click(function(){
                        var ckfinder = CKFinder.popup("/ckfinder/",null,null,function(selectURL){
                            if(/\.(jpg|gif|bmp|png|jpeg)$/.test(selectURL)){
                                var context = window.location.origin;
                                $imgHolder.css('background-image',"url('"+context+selectURL+"')");
                                field.prop("value",selectURL);
                            }else{
                                zui.warn("文件格式不合法","请选择以下格式中的图片：（jpg,gif,bmp,png,jpeg）")
                            }
                        })
                    });
                });
            },
            /**
             * 于zui-table联动，用于table-form的页面，在table载入后重新调整form的高度
             * @param $tableHolder
             * @param otherHeight
             */
            reHeightByTable : function($tableHolder){
                var form = this;
                $tableHolder.on('tableReload.zui',function(e,table){
                    var tableHeight = table.height===undefined?0:table.height;
                    var formIncrement = form.tableHeight-tableHeight;
                    if(formIncrement!==0){
                        form.tableHeight = tableHeight+10;
                        form.$body.outerHeight(form.$body.outerHeight()+formIncrement-10);
                    }
                });
            },
            initCurrentItem : function(){
                var id = this.$form.find("input[name=id]").prop("value");
                if(!zui.isEmptyStr(id)){
                    var $fields = this.$form.find(":input");
                    var zuiForm = this;
                    $fields.each(function(){
                        switch ($(this).attr('type')){
                            case "radio":
                            case "checkbox":
                                if($(this).prop('checked')){
                                    if(zuiForm._serverFields[$(this).attr('name')]===undefined){
                                        zuiForm._serverFields[$(this).attr('name')]=[];
                                    }
                                    zuiForm._serverFields[$(this).attr('name')].push($(this).prop('value'));
                                }
                                break;
                            default :
                                if($(this).prop('value')!=""){
                                    zuiForm._serverFields[$(this).attr('name')] = $(this).prop('value');
                                }
                        }
                    });
                }
            },
            bindValidation : function(settings){
                //validate
                var zuiForm = this;
                this._bindTabValidateStatus();
                zuiForm.$form.bootstrapValidator($.extend({},zuiForm.validatorSettings,settings));
                zuiForm.validator = zuiForm.$form.data('bootstrapValidator');
                return zuiForm;
            },
            /**
             * 表单验证有错的时候，需要更新form的header的状态。即header框变红，body框变红
             *
             * @private
             */
            _bindTabValidateStatus : function(){
                var that = this;
                if(this.type==="tabForm"){
                    that.$form.on("init.field.bv",function(e,bvFiledInit){
                        // bvFiledInit.bv -- bv对象
                        // bvFiledInit.field -- option传入field名称
                        // bvFiledInit.element -- filed转换成的JQ对象
                        var $fields = bvFiledInit.element;
                        $fields.each(function(index,field){
                            $(field).data('tabName',$(field).parentsUntil(that.$form,'.tab-content').attr("name"));
                        });
                    });
                }
                that.$form.on("error.form.bv",function(e){
                    that.updateTabValidateStatus();
                });
            },
            updateTabValidateStatus : function(){
                var $invalidFields = this.validator.getInvalidFields();
                if(this.type==="tabForm"){
                    var that = this;
                    $.each(this.zuiTab.tabs,function(key,value){
                        value.noError = true;
                    });
                    $.each($invalidFields,function(){
                        var tabName = $(this).data("tabName");
                        if(that.zuiTab.tabs[tabName].noError) that.zuiTab.tabs[tabName].noError=false;
                    });
                    $.each(this.zuiTab.tabs,function(key,value){
                        if(value['noError']){
                            value.$tab.removeClass("content-has-error");
                            if(value.$tab.hasClass("selected")){
                                that.$body.removeClass('content-has-error');
                            }
                        }else{
                            value.$tab.addClass("content-has-error");
                            if(value.$tab.hasClass("selected")){
                                that.$body.addClass('content-has-error');
                            }
                        }
                    });
                }else{
                    if($invalidFields.size()>0){
                        this.$body.addClass('content-has-error');
                    }else{
                        this.$body.removeClass('content-has-error');
                    }
                }
            },
            /**
             * resets field value to empty or remove checked/selected attribute for radio/checkbox
             * @param exclude {String} 排除的field。以filed的name属性识别，多个filed用逗号分割 like:"code,gender"
             * @param setAs {true|false} 是否使用给定的值进行赋值。如果不用默认就是checkbox全不选，input全空
             * @param assignVal {object} 设定赋值的对象格式为{name:value} 覆盖制定的field。如果没有改定，就以server端获取的数据填充
             */
            resetForm : function(exclude,setAs,assignVal){
                var $fields = this.$form.find(":input");
                var zuiForm = this;
                var excludes = !!exclude?exclude.split(","):null;
                $fields.each(function(){
                    var name = $(this).attr('name');
                    var isExcludeField = excludes!=null&&$.inArray(name,excludes)>=0;
                    var overwriteVal = null;
                    if(!!setAs){
                        overwriteVal = (!!assignVal)?((!!assignVal[name])?assignVal[name]:null):(!!zuiForm._serverFields[name]?zuiForm._serverFields[name]:null);
                    }
                    zuiForm.resetField($(this),isExcludeField,overwriteVal)
                });
                //清空选中item
                this._serverFields = {};
                if(this.type === "tabForm"&& this.validator){
                    //清空validator的有错fields集合
                    this.validator.$invalidFields = $([]);
                    this.updateTabValidateStatus();
                }
                //重置表单后执行handler
                if(this.postFormResetHandler.length>0){
                    for(var i=0;i<this.postFormResetHandler.length;i++){
                        var extraHandler = this.postFormResetHandler[i];
                        if($.type(extraHandler) === 'function'){
                            extraHandler();
                        }
                    }
                }
            },
            /**
             * 重置Feild的值（注意他不会清除server端的数据，调用resetForm才会）
             * @param $field {jQuery}
             * @param isExclude {boolean}
             * @param override {string|object|array} 用指定的值覆盖当前field。如果为null则input情况。check/radio 不勾选。select选第一个
             */
            resetField : function($field,isExclude,override){
                if($field.is(":disabled")) return;
                var name = $field.attr('name');
                if(!isExclude){
                    if($field.is("input")){
                        switch ($field.attr('type')){
                            case 'radio':
                            case 'checkbox':
                                if(override!==null){
                                   var checkItem = $field.prop('value');
                                   if($.type(override)==="array"&&override.length>0){
                                       //如果值是数组的情况
                                       var hit = false;
                                       for(var i=0;i<override.length;i++){
                                           if(checkItem===getVal(override[i],"id")) {
                                               $field.prop('checked', true);
                                               hit = true;
                                               break;
                                           }
                                       }
                                       if(!hit){
                                           $field.prop('checked', false);
                                       }
                                   }else{
                                       if(checkItem===getVal(override,"id")){
                                           $field.prop('checked', true);
                                       }else{
                                           $field.prop('checked', false);
                                       }
                                   }
                                }else{
                                    $field.prop('checked',false);
                                }
                                break;
                            default :
                                if(override!==null){
                                    $field.prop('value',override);
                                    if($field.data("thumbField")===true && override!==this.defaultThumbPath){
                                        $field.parent("div").css('background-image','url('+override+')');
                                    }
                                }else{
                                    $field.prop('value',"");
                                    if($field.data("thumbField")===true){
                                        $field.parent("div").css('background-image', this.defaultThumbPath);
                                    }
                                }
                        }
                    }else if($field.is("select")){
                        if(override!==null){
                            $field.children('option').filter('[value='+override+']').prop('selected',true);
                        }else{
                            $field.children('option:first').prop('selected',true);
                        }
                    }else if($field.is("textarea")){
                        if(override!==null){
                            $field.val(override);
                        }else{
                            $field.val("");
                        }
                    }
                }
                //如果这个field有绑定验证，重置验证信息
                if(this.validator&&this.validator.getOptions($field)!=null){
                    this.validator.resetField($field,false);
                }
            },
            /**
             * 更新操作
             * @param {boolean|object=} isRequestBody
             *                           1.如果为false或者不写 ajax的contentType类型为application/x-www-form-urlencoded，发送数据类型是FormData的形式 形如KEY=VALUE
             *                           2.如果为true，contentType=application/json 发送数据类型是payLoad，是一个整体，不能通过request.getParameter获取
             *                             requestBody方式用于提交二级制文件或者大段数据比较好。后台需相应修改用@RequestBody获取参数，用jackson转化成相应对象
             *                             看category.shtml的save就是第二种情况
             *                           3.object =ajaxSettings
             * @param {object=} data 需要更新的数据 (第一个参数可选)
             * @param {string=} url 用于交互的url
             * @returns {*}
             */
            update : function(isRequestBody,data,url){
                //支持函数重载，data->usingRequestBody 即update("application/json")的情况
                var url = (url&&$.type(url)==='string')?url:this.basePath+"/save";
                var postData = (data&&$.type(data)==='object')?data:null;
                var ajaxSettings = {};
                if(!isRequestBody){
                    ajaxSettings.contentType = "application/x-www-form-urlencoded";
                }else if($.type(isRequestBody)==="boolean"&&isRequestBody){
                    ajaxSettings.contentType = "application/json"
                }else if($.isPlainObject(isRequestBody)){
                    ajaxSettings=isRequestBody;
                    isRequestBody = !!ajaxSettings.contentType?(ajaxSettings.contentType === "application/json"):false;
                }

                if(postData===null){
                    postData = this.formToJSON(isRequestBody);
                }else{
                    postData = data;
                }
                if(!!this.sendConverter&&typeof this.sendConverter == "function"){
                    postData = this.sendConverter.call(this,postData);
                }
                if(!$.isEmptyObject(postData)){
                    return zui.communicate(url,isRequestBody?JSON.stringify(postData):postData, ajaxSettings,true,true);
                }

                return $.Deferred().reject({status:1001,msg:"没有需要更新的数据"},postData);
            },
            /**
             * 根据表单内容返回JSON对象
             * @param {boolean} flat 是否扁平化json对象  默认false(不填就是false)
             *                       说明：针对嵌套数据 如user.name
             *                            如果flat为false 那么生成的就是 {user:{name:{xxx}}}
             *                            如果flat为true 那么生成的就是 {'user.name':xxx}
             */
            getData : function(flat){
                return this.formToJSON(!flat);
            },
            remove : function(id){
                var url = this.basePath+"/delete";
                var postData = {id:id};
                var that = this;
                if(!$.isEmptyObject(postData)){
                    return zui.communicate(url,postData,{},true,true);
                }
                return null;
            },
            /**
             * 从服务器端获取数据，填充表单
             * @param {string|number|object=} data 1.string|number 要获取的数据ID。最后拼接到url中this.basePath+"/"+id
             *                                      2.object 要传给服务器的参数
             *                                      3.不填的话默认忽略传送数据，直接按url发请求
             * @param {string=} url 与服务器交互的url地址。如果url没设置 基础地址为创建form时指定的module：url = /module
             * @returns {*}
             */
            retrieve : function(data,url,silence){
                var zuiForm = this;
                var dfd = $.Deferred();
                var postData = $.isPlainObject(data)?data:{};
                if($.type(data)==="string"||$.type(data)==="number"){
                    data = "/"+data
                }else{
                    data = "";
                }
                if(!url){
                    url = this.basePath+data;
                }else{
                   url = url+data;
                }
                this._serverFields = {};
                zui.communicate(url,postData,null,silence).done(function(recieveData){
                    if(!!zuiForm.receiveConverter&&typeof zuiForm.receiveConverter == "function"){
                        recieveData = zuiForm.receiveConverter.call(zuiForm,recieveData);
                    }
                    if(!!recieveData&&!$.isEmptyObject(recieveData[zuiForm.formDataPropertyName])){
                        var $fields = zuiForm.$form.find(":input:not(:button,:submit,:reset)");
                        $fields.each(function(){
                            zuiForm.retrieveField($(this),recieveData[zuiForm.formDataPropertyName])
                        });
                        dfd.resolve();
                    }else{
                        dfd.reject();
                    }
                }).fail(function(){
                    dfd.reject();
                });
                //清空validator的有错fields集合
                if(!!zuiForm.validator){
                    zuiForm.validator.$invalidFields = $([]);
                    this.updateTabValidateStatus();
                }
                return dfd.promise();
            },
            /**
             * 通过给定的JSON数据填充表单
             * @param data 传入给定的JSON数据
             */
            setData : function(data){
                var zuiForm = this;
                var postData = data;
                if(!!zuiForm.receiveConverter&&typeof zuiForm.receiveConverter == "function"){
                    data = zuiForm.receiveConverter.call(zuiForm,data);
                }
                if(!$.isEmptyObject(data)){
                    var $fields = zuiForm.$form.find(":input:not(:button,:submit,:reset)");
                    $fields.each(function(){
                        zuiForm.retrieveField($(this),data)
                    });
                }else{
                    zuiForm.resetForm(null,false);
                }
            },
            retrieveField : function($field,field){
                var name = $field.attr('name');
                if(typeof name === "undefined"){
                    //有一些辅助的field，他们不对应后台实际的属性，只是为了操作方便 如全选 这种checkbox
                    //一般不给他们定义name属性，这里直接返回，不需要找server端的赋值，找也肯定没有
                    // this.resetField($field,false,null);
                    return;
                }
                var zuiForm = this;
                var serverVal = this.parseFieldValue(name, field);
                // if($field.is(":disabled")) return;
                if(serverVal!=null){
                    var fieldVal = $field.prop("value");
                    if($.type(serverVal) === "boolean"||$.type(serverVal) === "number") serverVal = serverVal.toString();
                    if($field.is("input")||$field.is("textarea")){
                        switch ($field.attr('type')){
                            case 'radio':
                                if(fieldVal===serverVal){
                                    $field.prop('checked',true);
                                }else{
                                    $field.prop('checked',false);
                                }
                                break;
                            case 'checkbox':
                                if($.type(serverVal) === "array"&&serverVal.length>0){
                                    var hit = false;
                                    for(var i = 0;i<serverVal.length;i++){
                                        if(fieldVal===getVal(serverVal[i],"id")) {
                                            $field.prop('checked', true);
                                            hit = true;
                                            break;
                                        }
                                    }
                                    if(!hit){
                                        $field.prop('checked', false);
                                    }
                                }else{
                                    if(fieldVal===getVal(serverVal,"id")){
                                        $field.prop('checked',true);
                                    }else{
                                        $field.prop('checked',false);
                                    }
                                }
                                break;
                            default :
                                $field.prop('value',serverVal);
                                if(fieldVal!==serverVal && $field.data("thumbField")===true){
                                    var imgURL = zui.isEmptyStr(serverVal)?this.defaultThumbPath:'url('+serverVal+')';
                                    $field.parent("div").css('background-image',imgURL);
                                }
                        }
                    }else if($field.is("select")){
                        $field.children("option[value="+serverVal+"]").prop('selected',true).siblings().prop("selected",false);
                    }
                }else{
                    zuiForm.resetField($field,false,null);
                }
                //如果这个field有绑定验证，重置验证信息
                if(!!this.validator&&this.validator.getOptions($field)!=null){
                    this.validator.resetField($field,false);
                }
            },
            /**
             * 解析后台传来的object对象成为control对应的值
             * 针对一些特殊情况
             * control对应的name="aaa.bbb.ccc" 他对应的object为 aaa:{bbb:{ccc:xxx}}
             * 该方法可解析出正确的control对应的value=xxx
             * 当然普通得name="aa"也试用
             * @param name
             * @param field
             * @returns {*}
             */
            parseFieldValue : function (name, field){
                if(this._serverFields[name] === undefined){
                    if(name.indexOf(".")>0){
                        var names = name.split(".");
                        var value = field;
                        for(var i = 0;i<names.length;i++){
                            value = value[names[i]];
                            if(zui.isEmptyStr(value)){
                                this._serverFields[name] = null;
                                break;
                            }else if (i === names.length-1){
                                //到达最后一个位置了
                                this._serverFields[name] = value;
                            }
                        }
                    }else{
                        this._serverFields[name] =  zui.isEmptyStr(field[name])?null:field[name]
                    }
                }
                return this._serverFields[name];
            },


            /**
             * 将form表单变成一个object
             * @param {boolean=} flatToHierachy 是否将扁平对象转化成JSON的有结构层次的对象，默认是false
             *                        默认输出输出对象是 {aa.bb:val1,cc:val2} 即永远只有一层
             *                        如果flat为true 则会输出为{aa:{bb:val1},cc:val2}可能含有多层。
             * @param {object=} data 需要处理的对象，不填会默认整个form的对象
             * @returns {{}}
             */
            formToJSON : function(flatToHierachy){
                var target = {};
                $.each(this.$form.serializeArray(),function(index,val){
                    var item,itemName;
                    if(flatToHierachy&&val.name.indexOf('.')>0){
                        var names = val.name.split('.');
                        item = target;
                        for(var i = 0 ;i<names.length;i++){
                            if(i<names.length-1){
                                if($.isEmptyObject(item[names[i]])) item[names[i]]={};
                                item = item[names[i]];
                            }else{
                                itemName = names[i];
                            }
                        }
                    }else{
                        item = target;
                        itemName = val.name;
                    }
                    if(item[itemName]){
                        //集合参数编程Array。同时兼容jackson和SpringMVC太麻烦。换一种思路
                        /*if($.type(target[val.name]) !== "array"){
                            var preVal = target[val.name];
                            target[val.name] = new Array();
                            target[val.name].push(preVal);
                        }
                        target[val.name].push(val.value);*/
                        //替换上面的，把集合参数编程逗号分割的id数组组成的字符串
                        item[itemName] +=","+val.value;
                    }else{
                        item[itemName] = val.value;
                    }
                });
                return target;
            },
            setSendConverter : function(sendConverter){
                this.sendConverter = sendConverter;
            },
            setRecieveConverter : function(receiveConterter){
                this.receiveConverter = receiveConterter;
            },
            addExtraValidator : function(validator){
                if($.type(validator)==="function"){
                    this.extraValidator.push(validator);
                }
            },
            addPostFormResetHandler : function(handler){
                this.postFormResetHandler.push(handler);
            },
            //改写服务器端验证
            validate : function(ignore,tryTimes,tryInterval){
                if(ignore === undefined) ignore=true;
                if (!this.validator.options.fields) {
                    return true;
                }
                var isValid = true;

                //检验extraValidator的自定义逻辑
                if(this.extraValidator.length>0){
                    for(var i=0;i<this.extraValidator.length;i++){
                        var extraV = this.extraValidator[i];
                        isValid = isValid && extraV.call(this);
                        if(!isValid) break;
                    }
                }

                if(isValid){
                    for (var field in this.validator.options.fields) {
                        this.validator.validateField(field);
                        var isValidField = this.validator.isValidField(field);
                        if(isValidField===null){
                            //ajax服务器端验证还没返回结果,这里抛弃对这个field的验证
                            if(ignore){
                                continue;
                            }else{
                                var fields = $([]);
                                switch (typeof field) {
                                    case 'object':
                                        fields = field;
                                        field  = field.attr('data-bv-field');
                                        break;
                                    case 'string':
                                        fields = this.validator.getFieldElements(field);
                                        break;
                                    default:
                                        break;
                                }
                                zui.processing("正在验证"+this.getLabelNameByField(field));
                                tryTimes = tryTimes===undefined?2:tryTimes;
                                tryInterval = tryInterval===undefined?500:tryInterval;
                                var startTime = new Date();
                                while(tryTimes==0){
                                    var now = new Date();
                                    if(now-startTime>tryInterval){
                                        startTime = now;
                                        isValidField = this.validator.isValidField(field);
                                        if(isValidField!=null){
                                            break;
                                        }else{
                                            tryTimes--;
                                        }
                                    }
                                }
                                //如果经过尝试还是空，就直接认为是验证失败了
                                if(isValidField===null){
                                    isValid = false;
                                    zui.warn("验证失败","表单填写有误，请检查"+this.getLabelNameByField(field)+"!<br/>");
                                    break;
                                }else{
                                    isValid = isValid && isValidField;
                                    zui.processed(true,"验证成功",this.getLabelNameByField(field)+"输入合法");
                                }
                            }
                        }else{
                            isValid = isValid && isValidField;
                            if(!isValid){
                                //有一个filed确定验证失败，跳出循环
                                break;
                            }
                        }
                    }
                }

                var eventType = isValid ? this.validator.options.events.formSuccess : this.validator.options.events.formError;
                this.validator.$form.trigger($.Event(eventType));
                return isValid;
            },
            revalidateField : function(field){
                this.validator.revalidateField(field);
            },
            get$FieldByName : function(fieldName){
                if (!this._nameTo$FieldsMap[fieldName]) {
                    //先从validator的缓存里找
                    if(this.validator !== undefined && this.validator.options.fields[fieldName] && this.validator.options.fields[fieldName].selector){
                        this._nameTo$FieldsMap[fieldName] = $(this.validatoroptions.fields[fieldName].selector)
                    }else{
                        // 如果没有再用JQ找
                        this._nameTo$FieldsMap[fieldName] =  this.$form.find("[name='" + fieldName + "']");
                    }
                }
                return this._nameTo$FieldsMap[fieldName];
            },
            getLabelNameByField : function($field){
                var fieldName;
                if(typeof $field === "string"){
                    fieldName = $field;
                    $field = this.get$FieldByName(field);
                }else{
                    fieldName = $field.attr("name");
                }
                if(!this._name2LabelMap[fieldName]){
                    this._name2LabelMap[fieldName] =  $field.parents(".form-group").children("label").html();
                }
                return this._name2LabelMap[fieldName];
            },

            markFieldAsValid : function(fieldName){
                this.validator.updateStatus(fieldName,'VALID');
            },
            /**
             * 取得服务器回传的当前表单对象ID，不受客户端对表单的修改的影响
             * @returns {*|null}
             */
            getCurrentID : function(){
                return this._serverFields.id||null;
            },
            /**
             * 取得服务器传来的当前表单对象，修改表单的值对这个对象没有影响，他永远映射的是服务器中的版本
             * @param field  -可选 获取对象的哪一个值 如果为空，就获取整个对象
             * @returns {*}
             */
            getServerFieldValue : function(field){
                if(!field){
                    if($.isEmptyObject(this._serverFields)) return null;
                    return this._serverFields;
                }else{
                    return this._serverFields[field];
                }
            },
            /**
             * 根据表单域取值，如果修改了值，这里取得的是修改以后的。
             * @param name
             * @returns {*}
             */
            getFormFieldValue : function(name){
                var $field = this.get$FieldByName(name);
                if($field){
                    var val;
                    if($field.is(':checkbox')){
                        val = $field.prop("checked");
                    }else{
                        val = $field.prop("value");
                    }
                    return val===''?null:val;
                }
                return null;
            },
            hideField : function(name){
                this.$form.find("[name="+name+"]").hide().parents(".form-group").hide();
            },
            showField : function(name){
                this.$form.find("[name="+name+"]").show().parents(".form-group").show();
            },
            /**
             * 显示一个tabHeader
             * @param index  需要隐藏的headerTab的索引或者这个元素代表的JQ对象
             */
            showTab : function(index){
                if(this.type !== "tabForm") return;
                this.zuiTab.showTab(index);
            },
            /**
             * 隐藏一个tabHeader
             * @param name {string|number|JQuery|Object}
             * String - li 元素对应的name属性
             * number - li 的序号，从零开始
             * JQuery - 代表目标li元素的JQ对象
             * object - 代表tab-content的内部tabs对象
             */
            hideTab : function(name){
                if(this.type !== "tabForm") return;
                this.zuiTab.hideTab(name);
            },
            /**
             * 获取当前显示的tab
             * @param prop 要获取的属性
             * null or undefined - 获取整个currentTab对象
             * String - 获取currentTab[name]属性
             */
            getCurrentTab : function(prop){
                if(this.type !== "tabForm") return;
                return this.zuiTab.getCurrent(prop);
            },
            /**
             * 显示某一个tab
             * @param name {string|number|JQuery|Object}
             * String - li 元素对应的name属性
             * number - li 的序号，从零开始
             * JQuery - 代表目标li元素的JQ对象
             * object - 代表tab-content的内部tabs对象
             */
            gotoTab : function(index){
                if(this.type !== "tabForm") return;
                this.zuiTab.goto(index);
            },
            buildCKEditor:function($textarea){
                this.$editor = $textarea;
                require(['ckeditor-jquery'],function(){
                    $textarea.ckeditor(function(){
                        CKFinder.setupCKEditor(this,"/ckfinder/");
                    });
                });
            },
            /**
             * 监听form表单的按钮事件
             * 20170811加入 为了统一对象调用，让前台JS代码多出现对象.方法的形式
             * 避免页面上dom操作和事件监听太多，提高代码阅读性。
             */
            addOperationListener : function(eventName,func) {
                if ($.isFunction(func)) {
                    this.opListener[eventName] = func;
                }
                return this;
            },
            /**
             * 绑定form表单也得按钮事件，并委托给由addOperationListener方法指定函数处理
             */
            _bindOpListener : function(){
                var form = this;
                var filterStr = this.$operation.hasClass("operations")?"span[data-op]":".operations>span[data-op]";
                this.$operation.on("click.zui",filterStr,function(){
                    var $btn = $(this);
                    var eventName = $btn.data("op");
                    if(!!form.opListener[eventName]){
                        form.opListener[eventName].call(form);
                    }
                });
            },

            /**
             *  根据fieldName勾选所有的checkbox选项
             * @param fieldName
             */
            checkAll : function(fieldName){
                var fields = this.get$FieldByName(fieldName);
                $.each(fields,function(idx,field){
                    if($(field).is(":checkbox")){
                        $(field).prop("checked",true);
                    }
                });
            },

            /**
             * 根据fieldName充值所有的chekbox选项
             * @param filedName
             * @param usingOriData false-默认全部选|true-根据server端数据选择
             */
            inverseCheckAll : function(filedName,usingOriData){
                var form = this;
                var $fields = this.get$FieldByName(filedName);
                var fieldValue = null;
                if(!!usingOriData){
                    fieldValue = this.getServerFieldValue(filedName);
                }
                $.each($fields,function(){
                    form.resetField($(this),false,fieldValue);
                });
            },

            /**
             * 功能传递，将zuiTab的功能写到这里，统一访问
             */
            postTabSwitch : function(func){
                this.zuiTab.postSwitch(func);
            }
        }
    }



}));