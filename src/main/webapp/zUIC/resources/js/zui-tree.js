/**
 * Created by 张未然 on 2016/4/20.
 *
 * 结合代码需求对Ztree进行封装。
 */

;(function(factory){
    if(typeof define === 'function' && define.amd ){
        //以AMD模式加载，RequireJS中用。
        define(['jquery','zuiFrame','zTree'],factory);
    }else if(jQuery){
        //以jQuery引入模式加载。
        factory(jQuery);
    }else{
        throw "Neither AMD nor jQuery is prepared for zuiFrame!";
    }
}(function($,zui,zTree){
    //扩展zTree 支持hide。参考exhide。但去掉的关于check和select的方法
    //增加ZTree初始化时 isHidden属性
    var _initNode = function(setting, level, n, parentNode, isFirstNode, isLastNode, openFlag) {
        // if (typeof n.isHidden == "string") n.isHidden = tools.eqs(n.isHidden, "true");
        // n.isHidden = !!n.isHidden;
        n.isHidden = false;
        n.iconSkin = n.type;
    };
    var _zTreeTools = function(setting, zTreeTools) {
        zTreeTools.showNode = function(node) {
            if (!node) {
                return;
            }
            if(node.isHidden){
                node.isHidden = false;
                nodeTo$(node, setting).show();
            }
        };
        zTreeTools.hideNode = function(node) {
            if (!node) {
                return;
            }
            if(!node.isHidden){
                node.isHidden = true;
                nodeTo$(node, setting).hide();
            }
        };
        zTreeTools.highlightNode = function(node) {
            if (!node) {
                return;
            }
            if(!node.highlight){
                node.highlight = true;
                nodeTo$(node,"_a", setting).css(DEFAULTS.highlightCSS);
            }
        };
        zTreeTools.unHighlightNode = function(node) {
            if (!node) {
                return;
            }
            if(node.highlight){
                node.highlight = false;
                nodeTo$(node,"_a", setting).css(DEFAULTS.normalCSS);
            }
        };
    };
    zTree._z.data.addInitNode(_initNode);
    zTree._z.data.addZTreeTools(_zTreeTools);


    function nodeTo$(node, exp, setting) {
        if (!!exp && typeof exp != "string") {
            setting = exp;
            exp = "";
        }
        if (typeof node == "string") {
            return $(node, setting ? setting.treeObj.get(0).ownerDocument : null);
        } else {
            return $("#" + node.tId + exp, setting ? setting.treeObj : null);
        }
    }

    var DEFAULTS = {
        treeBoxHeight:300,
        treeBoxWidth:150,
        highlightCSS:{"color":"#A60000", "font-weight":"bold"},
        normalCSS:{"color":"", "font-weight":""},
        selected:null
    };


    var ZUI = $('body').data('ZUI');
    if(!ZUI){
        console.error("Require zuiFrame loaded before invoking！")
    }else{

        var ZUITree = function(){
            this.$container = null;//建立树的容器（一般是包含search组件和tree组件的DIV）
            this.type = "inline";//树的类型；现在有两种，inline是左侧显示，dialog是点击input弹出
            this.$tree=null;//jquery对象->对应ul含有树的DIV
            this.tree = null;//zTree对象
            this.dialogIsShown = false;
            this.opts={};
            this.initResult = $.Deferred();
            this._search={
             lastVal : "",
             lastHit : 0,
             hit:0,
             $info:null,//显示搜索结果的panel
            };
        };
        ZUITree.prototype = {
            constructor : ZUITree,
            settings:{
                view : {
                    dblClickExpand : false,//关闭双击展开节点功能
                    autoCancelSelected: false//点击节点时，按下 Ctrl 或 Cmd 键是否允许取消选择操作。
                },
                async : {
                    enable : true,
                    dataType : "json",
                    dataFilter : function(treeId,parentNode,responseData){
                        if($.isPlainObject(responseData)){
                            if(zui.isUDF(parentNode)){
                                return responseData.tree;
                            }else{
                                //一般到不了这里，如果到这里其实用嵌套获取
                                return responseData.tree[parentNode.name];
                            }
                        }
                        return {};
                    }
                },
                callback: {
                    // onClick: clickTreeNode,
                    // onAsyncError:  移动到_initTree动态添加这个属性
                    // onAsyncSuccess:  移动到_initTree动态添加这个属性
                },
            },
            search : function(val){
                var text = $.trim(val).toLowerCase();
                //重复输入，不进行搜索
                if(text===this._search.lastVal) return;
                this._search.lastVal = val;
                //输入为空，显示全部节点
                if(text==""){
                    this._cancelHit(this.tree.getNodes());
                    this._search.lastHit = 0;
                    this._search.$info.hide();
                    this.tree.expandAll(true);
                    return;
                }
                this._search.hit=0;
                var hit = this._filterTree(this.tree.getNodes(),text);
                if(hit){
                    //通知：查询到 this._search.hit 个 结果
                    this._search.$info.html("查询到 "+this._search.hit+" 条结果！").removeClass('fail').addClass('success').show();
                    // console.info("查询到"+this._search.hit+"个结果！");
                }else{
                    this._search.$info.html("没有查询到任何匹配项！").removeClass('success').addClass('fail').show();
                    // console.info("没有查询到任何匹配项！");
                }
                this._search.lastHit = this._search.hit;
                // zui.popUp($("#tree_searchInfo").removeClass("success").addClass("fail"),"没有找到相应栏目",1000,null);
                // zui.popUp($("#tree_searchInfo").removeClass("fail").addClass("success"),"找到"+_searchResults.length+"条记录",500,null);
            },
            selectNodeByID : function(id){
                if(!!id){
                    var selNode = this.tree.getNodeByParam("id",id);
                    this.tree.selectNode(selNode);
                }else{
                    this.tree.cancelSelectedNode();
                }
            },
            unSelectedNodes : function(node){
                if(!node){
                    this.tree.cancelSelectedNode();
                }else{
                    this.tree.cancelSelectedNode(node);
                }
            },
            _filterTree : function(nodes,val){
                var childrenHit = false,
                     selfHit = false,
                    collectionHit = false;

                for(var i=0;i<nodes.length;i++){
                    var node = nodes[i];
                    if(!!node.children&&node.children.length>0){
                        childrenHit = this._filterTree(node.children,val)||childrenHit;
                    }

                    selfHit = node.name.toLowerCase().indexOf(val)>-1||node.code.toLowerCase().indexOf(val)>-1;
                    if(selfHit){
                        this.tree.highlightNode(node);
                        this.tree.expandNode(node,true,false,true);
                        this._search.hit++;
                    }else{
                        this.tree.unHighlightNode(node);
                    }

                    if(selfHit||childrenHit){
                        this.tree.showNode(node);
                        if(childrenHit){
                            this.tree.expandNode(node,true,false,false);
                        }
                    }else{
                        this.tree.hideNode(node);
                        this.tree.expandNode(node,false,false,false);

                    }
                    collectionHit = collectionHit||selfHit||childrenHit;
                    childrenHit = false;//如果index=1的children命中之一想index1 index2要重新再看。
                }
                return collectionHit;
            },
            _cancelHit : function(nodes){
                for(var i=0;i<nodes.length;i++){
                    var node = nodes[i];
                    if(!!node.children&&node.children.length>0){
                        this._cancelHit(node.children);
                    }
                    this.tree.showNode(node);
                    this.tree.unHighlightNode(node);
                }
            },
            refresh : function(selectedID){
                var zuiTree = this;
                var tree = this.tree;
                this.initResult=$.Deferred();
                tree.reAsyncChildNodes(null,"refresh",false);
                this.initResult.done(function(){
                    tree.expandAll(true);
                    if(!!selectedID){
                        tree.selectNode(tree.getNodeByParam("id",selectedID));
                    }
                    /*if(zuiTree.opts.selected!=null){
                        zuiTree.selectNodeByID(zuiTree.opts.selected);
                    }*/
                })

            },
            onClick : function(func){
                var that = this;
                if($.isFunction(func)){
                    this.$tree.off("ztree_click").on("ztree_click",function(event, srcEvent, treeId, node, clickFlag){
                        func.apply(that,[node,treeId,srcEvent,clickFlag]);
                    });
                }
            },
            toggleNode: function(node){
                this.tree.expandNode(node);
            },
            expandeNode : function(node){
                this.tree.expandNode(node,true)
            },
            collapseNode : function(node){
                this.tree.expandNode(node,false);
            },
            expandeAll : function(){
                this.tree.expandAll(true);
            },
            collapseAll : function(){
                this.tree.expandAll(false);
            },
            showDialog : function(){
                if(this.type==="dialog"&&!this.dialogIsShown){
                    var that = this;
                    that.$container.show();
                    this.dialogIsShown = true;
                    //点击其他地方隐藏
                    $("#main-panel-wrapper").children(".main-panel").off("click.zui").on("click.zui",function(e){
                        var $target = $(e.target);
                        if(that.dialogIsShown&&$target.closest(that.$container.parent()).length===0){
                            that.hideDialog();
                        }
                    });
                    //按下ESC隐藏
                    $(document).off("keydown.zui").on("keydown.zui",function(e){
                        if(that.dialogIsShown&&e.keyCode===27) {
                            that.hideDialog();
                        }
                    });
                }
            },
            hideDialog : function(){
                if(this.type==="dialog"&&this.dialogIsShown){
                    this.$container.hide();
                    this.dialogIsShown = false;
                    $(document).off("keydown.zui").off("click.zui");
                }
            },
            toggleDialog : function(){
                if(this.type==="dialog"){
                    if(this.dialogIsShown){
                        this.hideDialog();
                    }else{
                        this.showDialog();
                    }
                }
            }
        };

        ZUI.prototype.buildTree = function($container,treeData,options,treeType){

            if(!this.isJQDom($container)){
                console.error("specified container is not containing any DOM elements!");
                return;
            }
            var zuiTree = new ZUITree();

            //构建树形结构
            if(!treeType||treeType==='inline'){
                if(!zui.hasDom($container)){
                    //如果页面值给出了空的div，这里负责构建tree用到的html的结构
                    var treeContent = '<div class="tree-search-box form-inline">'+
                                            '<div class="form-group has-feedback">'+
                                                '<label class="control-label text-primary">&nbsp;搜索&nbsp;</label>'+
                                                '<div class="input-group">'+
                                                    '<input type="text" class="form-control"/>'+
                                                    '<span class="input-group-addon"><i class="fa fa-search form-control-feedback"></i></span>' +
                                                '</div>'+
                                            '</div>'+
                                            '<div class="form-group search-info"></div>'+
                                        '</div>'+
                                        '<ul id="'+$container.attr("id")+'_ztree" class="ztree"></ul>';
                    $container.append(treeContent);
                }
            }else if(treeType === 'dialog'){
                var $input=$container.css("position","relative");
                $container = $('<div class="tree-box">'+
                                        '<div class="tree-search-box form-inline">'+
                                            '<div class="form-group has-feedback">'+
                                                '<label class="control-label text-primary">&nbsp;搜索&nbsp;</label>'+
                                                '<div class="input-group">'+
                                                    '<input type="text" class="form-control"/>'+
                                                    '<span class="input-group-addon"><i class="fa fa-search form-control-feedback"></i></span>' +
                                                '</div>'+
                                            '</div>'+
                                            '<div class="form-group search-info"></div>'+
                                        '</div>'+
                                        '<ul class="ztree"></ul>'+
                                    '</div>');

                $container.width($input.outerWidth()).hide().insertAfter($input);
                //注册点击input的事件
                $input.click(function(e){
                    e.preventDefault();
                    zuiTree.toggleDialog();
                });
            }else{
                console.error("wrong treeType when building zuiTree!");
            }

            var $zTree = $container.children(".ztree");
         /*   if(!$tree.is('ul')&&!$tree.is('div')&&!$tree.is(':input')){
                console.warn("Can not handle container with tag: "+$tree.get(0).tagName.toLowerCase());
                return;
            }*/

            zuiTree.opts = $.extend({},DEFAULTS,options);
            zuiTree.$tree = $zTree;
            zuiTree.$container = $container;
            zuiTree.type=treeType;
            _initZtree(zuiTree,treeData).done(function(){
                zuiTree.tree.expandAll(true);
                if(zuiTree.opts.selected!=null){
                    zuiTree.selectNodeByID(zuiTree.opts.selected);
                }
            });
            //绑定树搜索
            var $search = $container.children(".tree-search-box");
            if(this.isJQDom($search)){
                $search.on('click.zui',"span:first",function(event){
                    zuiTree.search($search.find("input[type=text]:first").prop('value'));
                });
                $search.on('keydown.zui',"input[type=text]:first",function(event){
                    event.stopPropagation();
                    if(event.keyCode==13){
                        zuiTree.search($(this).prop('value'));
                    }
                    //当tree在一个form中 如果按了回车会提交表单。return false 阻止提交
                    return false;
                });
                zuiTree._search.$info = $search.find('.search-info').hide();
            }
            return zuiTree;
        };

        function _initZtree(zuiTree,treeData){
            var $container=zuiTree.$tree,
                settings=zuiTree.settings;
            if($.type(treeData)==="string"){
                treeData = zui.buildPath(treeData);
                settings.async.url = treeData;
                settings.callback.onAsyncError = function(event, treeId, treeNode, XMLHttpRequest, textStatus, errorThrown){
                    zui.handleTransDataError(XMLHttpRequest, textStatus, errorThrown);
                    zuiTree.initResult.reject();
                };
                settings.callback.onAsyncSuccess = function(event, treeId, treeNode, msg){
                    zuiTree.initResult.resolve();
                };
                zuiTree.tree =  zTree.init($container, settings,null);
            }else{
                settings.async.enable = false;
                zuiTree.tree =  zTree.init($container, settings, treeData);
                zuiTree.initResult.resolve();
            }
            //加入到zuiTree的settings中了
          /*  zuiTree.tree.on("ztree_async_success",function(event, treeId, treeNode, msg){
                deferred.resolve();
            });*/
            zuiTree.treeId = $container.attr('id')+"_ztree";
            return  zuiTree.initResult.promise();
        }

        function clickTreeNode(event, treeId, treeNode, clickFlag){
            if(treeNode.level==0){
                //根节点不响应点击操作
            }else{
                if(treeNode.isParent){
                    //点击的是父节点
                }else{
                    //点击的是子节点
                }
                zuiTree.tree.expandNode(treeNode);
            }
        }

    }
    
}));