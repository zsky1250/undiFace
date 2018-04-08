/**
 * Created by 张未然 on 2016/6/6.
 */


;(function(factory){
    if(typeof define === 'function' && define.amd ){
        //以AMD模式加载，RequireJS中用。
        define(['jquery','zuiFrame','dtBootstrap'],factory);
    }else if(jQuery){
        //以jQuery引入模式加载。
        factory(jQuery);
    }else{
        throw "Neither AMD nor jQuery is prepared for zuiFrame!";
    }
}(function($,zui,dataTable){

    var ZUI = $('body').data('ZUI');
    if(!ZUI){
        console.error("Require zuiFrame loaded before invoking！");
        return;
    }

    /**
     * 创建表格JS，返回zuiTable对象
     * @param $tableContainer 表格所在的JQ对象
     * @param settings 表格相关设置
     * @param $tableSearch 和表格关联的表单对象
     * @param btnGroup 批量操作按钮。显示在左下脚
     * 支持函数重载 可以是($tableContainer,settings,$tableSearch) 或 ($tableContainer,settings,btnGroup)
     * @returns {ZUITable}
     */
    ZUI.prototype.buildTable = function($tableContainer,settings,$tableSearch,btnGroup){
        if(!this.isJQDom($tableContainer)){
            console.warn("specified container is not containing any DOM elements!");
            return;
        }
        //buildTable
        var zuiTable = new ZUITable($tableContainer,settings,btnGroup);


        if(this.isJQDom($tableSearch)){
            zuiTable.bindSearch($tableSearch);
        }else if(typeof btnGroup === "undefined"){
            //支持函数重载，如果没有第四个参数
            btnGroup = $tableSearch;
        }

        if($.isArray(btnGroup)&&btnGroup.length>0){
            zuiTable.bindOperation(btnGroup,$tableContainer);
        }
        return zuiTable;
    };

    /**
     * zuiTable对象。用于显示表格
     * @param $tableContainer 需要构建的$jq对象 一般为<table id="userTable" class="table-bordered"></table>
     * @param settings 表格设置属性
     * @param $tableSearch 和表格关联的搜索控件
     * @param btnGroup  表格左下脚的批量操作按钮
     * 支持函数重载 参数可以是（$tableContainer,settings,$tableSearch）
     *             或者（$tableContainer,settings,btnGroup）
     * @returns {ZUITable}
     */
    var ZUITable = function($container, settings){
        var that = this;
        this.$ = $container;
        if(!settings){
            console.error("table插件初始化参数不能为空");
            return null;
        }
        this.searchListener = {};
        this.operationListener = {};
        this.registerItemOp = false;
        this.registerBatchOp = false;
        this.DTSettings = $.extend(true,{},this.DEFULATS.DTSettings,settings.table);
        this.DTSettings.ajax.url = zui.buildPath(settings.serverURL);
        this.checkMode = settings.check?settings.check:false;
        this.sortValue = settings.sort?settings.sort:false;
        this.sortVar = settings.sortVar?settings.sortVar:this.DEFULATS.sortVar;
        if(!$.isEmptyObject(settings.initData)) this.search = settings.initData;

        if(this.DTSettings.columns){
            //给每一个column定义一个默认别名便于api查找。前提是name没定义且data有定义,那么(column.name=column.data)，
            //可以使用table.getColumnByName("别名")来定位列。底层实现为table.column('别名:name')
            $.each(this.DTSettings.columns,function(index,val){
                if(!!val.data&&!val.name){
                    val.name = val.data
                }
            });
            //解析operation按钮（如果有）
            _buildOPColumn(this,$container);
        }
        if(settings.height){
            this.DTSettings.scrollY = settings.height;
        }
        if(settings.size){
            this.DTSettings.lengthMenu=settings.size;//每页显示多少条
        }

        /*一定要先插入sort列，因为使用的方法是吧构造好的对象插入栈顶，要保证idcolumn在最前*/
        _insertSortColumn(this,$container);
        _insertIDColumn(this,$container);

        //载入前注册preXhr事件，在ajax请求时插入自定义的search值
        $container.on('preXhr.dt', function(e, settings, data){
            if(!$.isEmptyObject(that.search)){
                $.each(that.search,function(name,value){
                    data[name] = value;
                });
            }
        });

        this.dt = $container.DataTable(this.DTSettings);

        $container.on("draw.dt",function(e,settings,json,xhr){
            var tableHeight = $container.parents(".dataTables_wrapper").height();
            $container.trigger("tableReload.zui",{height:tableHeight});
        });

        $.fn.dataTable.ext.errMode = function(settings, techNote, message){
            // console.error(message);
            var jqXHR = settings.jqXHR;
            var noTransDataError = zui.handleTransDataError(jqXHR);
            if(noTransDataError){
                zui.processed(false,"列表载入错误",message);
            }
        };

        // $.fn.dataTable.ext.errMode = "throw";

        $container.on('init.dt',function(){
            if(!zui.isEmptyStr(settings.selected)){
                that.selectRowByID(settings.selected);
            }
            //将列表行数据的操作事件广播给zuitable对象，便于后续监听
            if(that.registerItemOp){
                $container.on('click.zui','tbody>tr .operations>span[data-op]',function(){
                    var $btn = $(this);
                    var eventName = $(this).data("op");
                    if(!!that.operationListener[eventName]){
                        var id = $btn.parent().data("id");
                        var rowData = that.getRowByID(id).data();
                        if(rowData.length===0) rowData=null;
                        var isBatch = false;
                        that.operationListener[eventName].call(that,rowData,isBatch);
                    }
                });
            }
            //监听行选择事件
            $container.on('click.zui','tbody>tr',function(){
                var selectEvent = "rowSelected";
                if(!!that.operationListener[selectEvent]){
                    // var rowData = that.getRowByID(this.id).data();
                    that.selectRowByID(this.id);
                    that.operationListener[selectEvent].call(that,this.id);
                }
            });
        });
        /**
         * 自动在第一列插入一个ID列
         * 如果settings.check为true。将ID列渲染成checkbox的样子
         *                   为flase，将ID列渲染成序号列。
         */
        function _insertIDColumn(zuitable,$container){
            var IDColumn = {
                data:"id",
                className:"dt-center",
                width:"25px",
                orderable:false,
            };
            if(settings.check){
                IDColumn.title="<input type='checkbox' id='tableCheckAll'/>";
                IDColumn.render = function( data, type, row, meta ){
                    if(type === 'display'){
                        return "<input type='checkbox' name='id' value='"+data+"'/>";
                    }
                    return data;
                };
                _bindCheckAll($container);
                //初始化默认不选中checkAll
                $container.on('draw.dt',function(e,settings) {
                    $("#tableCheckAll").prop("checked",false);
                });
            }else{
                IDColumn.title="#";
                //重绘时重新编号
                $container.on('draw.dt',function(e,settings){
                    $(this).dataTable().api().column(0).nodes().each(function (cell, i) {
                        cell.innerHTML = i + 1;
                    });
                });
            }
            zuitable.DTSettings.columns.unshift(IDColumn);
        }

        /**
         * 绑定全选checkbox
         * 如果是用滚动条 通过table.children("input")来选择checkbook会漏选head中的checkbox。
         *因为组件会默认加一个<div:class=dataTables_scrollHead>，真正的TableHEAD被隐藏，显示的是另一个div中的head。
         *而此处dt对象是<div:class=dataTables_scrollBody>中的table。
         *dt.find("thead th input:checkbox");
         * @param $container
         */
        function _bindCheckAll($container){
            //先尝试绑定dataTables_scrollHead 如果没有该元素说明页面没有滚动条 再绑定真是元素
            $container.parent().on("change.zui",'#tableCheckAll',function(){
                var checkValue = $(this).prop("checked");
                $container.DataTable().column(0).nodes().to$().children("input:checkbox").prop("checked", checkValue);
            });
        }

        /**
         *  插入辅助的配序列
         *  根据Settings.sort来决定插入列的形式。(注意：默认指定的对应属性是sortValue，如果要更改请设置sortVar="xxx")
         *  目前支持
         *  Settings.sort = input 讲排序列渲染成一个文本框，代表sortVar的值，用户可自己编辑，值大的排在顶端
         *  不设置Settings.sort 将不插入值
         */
        function _insertSortColumn(zuitable,$container){
            if(zuitable.sortValue){
                var sortColumn = {
                    data:zuitable.sortVar,
                    name:zuitable.sortVar,
                    title:"排序",
                    width:40,
                };
                if(zuitable.sortValue==="input"){
                    sortColumn.render = function(data,type,row,meta){
                        if(type==='display'){
                            return '<input class="sortColumn" data-rowid="'+row.id+'" style="width: 35px;text-align: center;ime-mode: disabled;" value="'+data+'">';
                        }
                        return data;
                    };
                    //排序文本框监听：只允许输入数字
                    $container.on('keyup',"input.sortColumn",function(event){
                        var text = $(this).prop("value");
                        var formatText = text.replace(/[^\d]/g,'');
                        if(text !== formatText){
                            $(this).prop("value",formatText);
                        }
                    });
                }
                zuitable.DTSettings.columns.unshift(sortColumn);
            }
        }

        /**
         * 如果构造的table含有op列，解析这个列为按钮，并注册相应监听器。
         * 格式如下["名字","op名称","class名称（可选，不填或者null表示与op相同）",dataHandler(可选，一个数据处理器)]
         *  最终转化为-->'<span class="btn.class" data-op="btn.op"><i></i>btn.name</span>'
         * 如果有dataHandler，他接受的参数(btnData,rowData) btnData:{name,op,class}为构造btn用的三个属性 可在函数内部修改。
         * dataHandler如果返回false将不构造这个btn
         * @param zuitable
         * @param $container
         */
        function _buildOPColumn(zuitable,$container){
            var opColumn = zuitable.DTSettings.columns.pop();
            if(!!opColumn&&(opColumn.data==="op"||opColumn.name==="op")){
                var opColumnDefault = {
                    title:"操作",
                    width:120,
                    orderable:false
                };
                opColumn = $.extend(true,{},opColumnDefault,opColumn);
                if(!!opColumn.btn&&opColumn.btn.length>0){
                    parseOPByBtnColumn(opColumn);
                }
                opColumn.data=null;
                //标记使用了op列则后续注册监听 前台可使用table.addOperation("opname",function())来实现btn操作
                zuitable.registerItemOp = true;
            }
            zuitable.DTSettings.columns.push(opColumn);


            /**
             * 解析的逻辑
             * @param opColumn
             */
            function parseOPByBtnColumn(opColumn){
                    opColumn.render = function(data,type,row,meta){
                        if(type==='display'){
                            var rowContext = this;
                            var parseBtns = [];
                            $.each(opColumn.btn,function(idx,item){
                                if($.type(item)==="array"&&item.length>1){
                                    var btn = {};
                                    btn.name = item[0],btn.op=item[1],btn.show = true;
                                    if(item.length>2){
                                        if($.type(item[2])==="string"){
                                            //如果第三个值是字符 表示btn的Class
                                            btn.cssClass = item[2];
                                        }else if($.type(item[2])==="function"){
                                            //如果是function 表示DataHandler
                                            if(item[2].call(rowContext,btn,row)===false) return true;
                                        }
                                    }
                                    if(item.length>3){
                                        if($.type(item[3])==="function"){
                                            //如果是function 表示DataHandler
                                            if(item[3].call(rowContext,btn,row)===false) return true;
                                        }
                                    }
                                    var btnStr = '<span ' +
                                                'class="'+(btn.cssClass?btn.cssClass:btn.op)+'" ' +
                                                'data-op="'+btn.op+'" ' +
                                                'style="display:'+(btn.show?"inline-block":"none")+'" '+
                                                '><i></i>'+btn.name+'</span>';
                                    parseBtns.push(btnStr);
                                }
                            });
                            if(parseBtns.length>0){
                                return '<div class="operations table-item-op" data-id="'+row.id+'">'+parseBtns.join('')+'</div>';
                            }
                        };
                    delete opColumn.btn;
                }
            }
        }
    };

    ZUITable.prototype={
        constructor:"ZUITable",
        dt:null,
        search:{},
        $query:null,
        DEFULATS : {
            sortVar : "sortValue",
            DTSettings : {
                processing : true,//显示处理中的标签
                serverSide : true,//使用服务器端交互模式
                autoWidth: true,
                //scrollY : "330",//table的高度
                scrollCollapse : true,//如果行数少于标准的条数，是否缩短表格高度
                //scrollX:"100%",
                dom: 't<"table-page-Info"ip>',
                searching : false,//是否开启客户端查询，纯js过滤，我们可以考虑服务器端过滤。
                paging: true,//是否开启分页插件
                lengthChange: false,//用户可不可以自己修改显示的条数
                lengthMenu : [10],//每页显示多少条
                ordering:  true,//开启排序功能
                order : [ [ 0, "desc" ] ],
                language : {
                    processing:   "载入数据...",
                    search   :   "查询",
                    lengthMenu:   "显示 _MENU_ 项结果",
                    zeroRecords:  "没有匹配结果",
                    info:         "显示第 _START_ 至 _END_ 项结果，共 _TOTAL_ 项",
                    infoEmpty:    "显示第 0 至 0 项结果，共 0 项",
                    infoFiltered: "(查询结果： _MAX_ 项)",
                    infoPostFix:  "",
                    sUrl:          "",
                    emptyTable:     "没有对应数据",
                    loadingRecords: "载入中...",
                    sInfoThousands:  ",",
                    decimal       :  ",",
                    paginate: {
                        "first":    "首页",
                        "previous": "上页",
                        "next":     "下页",
                        "last":     "末页"
                    },
                    aria: {
                        "sortAscending":  ": 以升序排列此列",
                        "sortDescending": ": 以降序排列此列"
                    }
                },
                // 推荐的ajax交互写法，目前这个插件不能动态增加列，所以不用这种方式。
                ajax : {
                    "type" : "POST",
                    // "contentType":"application/json;charset=utf8",
                    //"dataSrc": "content",
                    "data" : function(sendData) {
                        var serverData = {};
                        serverData.page = sendData.start / sendData.length;
                        serverData.size = sendData.length;
                        if(sendData.order.length>0){
                            var col_index = sendData.order[0].column;
                            var orderdir = sendData.order[0].dir;
                            var ordername = sendData.columns[col_index].data;
                            serverData.sort = ordername + "," + orderdir;
                        }
                        serverData.draw = sendData.draw;
                        return serverData;
                    },
                    "dataSrc" : function(receiveData){
                        receiveData.recordsTotal = receiveData.tableList.totalElements;
                        receiveData.recordsFiltered = receiveData.tableList.totalElements;
                        //修改服务器数据，给行tr加入ID属性。
                        if(receiveData.tableList.totalElements>0&&!!receiveData.tableList.content[0].id){
                            $.each(receiveData.tableList.content,function(index,item){
                                item['DT_RowId'] = item.id;
                            });
                        }
                        delete receiveData.tableList.totalElements;
                        return receiveData.tableList.content;
                    }
                },
            },
        },
        /**
         * 将search组件绑定给table，注册pre post监听
         * @param $search
         */
        bindSearch : function($search){
            var that = this;
            this.$query = $search;
            $search.on('click.zui','span[data-op=search]',function(){
                $search.find(":input").each(function(){
                    var value = $(this).prop("value");
                    if(zui.isEmptyStr(value)){
                        delete that.search[$(this).attr("name")];
                    }else{
                        that.search[$(this).attr("name")] = value;
                    }
                });
                var allowSearch = $.Deferred();
                if(!!that.searchListener["preSearch"] && $.isFunction(that.searchListener["preSearch"])) {
                    var result = that.searchListener["preSearch"].call(that,that.search);
                    if (result === false){
                        allowSearch.reject();
                    }
                    if ($.type(result) === 'object' && $.isFunction(result.done)) {
                        //如果callback返回的是延迟对象
                        allowSearch = result;
                    } else {
                       allowSearch.resolve();
                    }
                }else{
                    allowSearch.resolve();
                }

                allowSearch.done(function(){
                    that.dt.ajax.reload();
                    if(!!that.searchListener["postSearch"]&& $.isFunction(that.searchListener["postSearch"])){
                        that.searchListener["postSearch"].call(that,that.search);
                    }
                });
            });
            $search.on('click.zui','span[data-op=reset]',function(){
                $search.find(":input").each(function(){
                    delete that.search[$(this).attr("name")];
                    $(this).prop("value","");

                });
                var allowReset = $.Deferred();
                if (!!that.searchListener["preReset"] && $.isFunction(that.searchListener["preReset"])) {
                    var result = that.searchListener["preReset"].call(that,that.search);
                    if(result === false) allowReset.reject();
                    if ($.type(result) === 'object' && $.isFunction(result.done)) {
                        //如果callback返回的是延迟对象
                        allowReset = result;
                    } else {
                        allowReset.resolve();
                    }
                } else {
                    allowReset.resolve();
                }
                allowReset.done(function(){
                    that.dt.ajax.reload();
                    if(!!that.searchListener["postReset"] && $.isFunction(that.searchListener["postReset"])){
                        that.searchListener["postReset"].call(that,that.search);
                    }
                });
            });

            $search.off('keyup',"input[type=text]").on('keyup.zui',"input[type=text]",function(event){
                if(event.keyCode==13){
                    $search.find("span[data-op=search]").trigger("click.zui");
                }
            });
        },
        /**
         * 将批量操作按钮绑定到table
         * @param btnGroup
         * @param $container
         */
        bindOperation : function(btnGroup, $container){
            var that = this;
            var deferred = $.Deferred();
            if($.type(btnGroup)==='array'){
                $.each(btnGroup,function(idx,btnItem){
                    btnGroup[idx] = parseOperationBtn(btnItem);
                });
                var html = $('<div class="operations">'+btnGroup.join("")+'</div>');
                this.dt.on("init.dt",function(){
                    $container.parents(".dataTables_wrapper").children(".table-page-Info").prepend(html).find('.operations>span[data-op]').each(function(){
                        $(this).on("click.zui",function(){
                            var eventName = $(this).data("op");
                            $container.trigger("operation-"+eventName);
                            var $btn = $(this);
                            //将列表整体操作事件广播给zuitable对象，便于后续监听
                            if(!!that.operationListener[eventName]){
                                var rowData = null;
                                if(that.checkMode){
                                    rowData = that.getCheckedRows().data();
                                    if(rowData.length===0) rowData = null;
                                }
                                var isBatch = true;
                                that.operationListener[eventName].call(that,rowData,isBatch);
                            }
                        })
                    });
                    that.$.trigger("operationInit.zui");
                    deferred.resolve();
                });
            }

            // 如果btnGroup形如["名字","op名称","class名称（可选，不填的话和op相同）"]
            // 需要二次转化为'<span class="class名称" data-op="op名称"><i></i>名字</span>'的形式
            function parseOperationBtn(btnItem){
                if($.type(btnItem)==='array'&&btnItem.length>1){
                    var opName = btnItem[0],op=btnItem[1],opClass=op;
                    if(btnItem.length>2){
                        opClass=btnItem[2]
                    }
                    btnItem = '<span class="'+opClass+'" data-op="'+op+'"><i></i>'+opName+'</span>';
                }
                return btnItem;
            }
            return deferred.promise();
        },
        /**
         * 刷新表格
         */
        refresh : function(){
            this.dt.ajax.reload();
        },
        resetQuery : function(){
            var that = this;
            if(this.$query!=null){
                this.$query.find(":input").each(function(){
                    delete that.search[$(this).attr("name")];
                    $(this).prop("value","");
                });
            }
        },
        /**
         * 根据JQ行对象，获取对应的data对象
         * @param {integer|string|Object|function|plainObject} selector
         *
         * integer - Row entrance selector
         * string - ID selector DT内部对何种选择有优化，不会访问DOM，推荐使用。
         * string - jQuery selector
         * node - This may be one of the following:
         * tr - table row element
         * td - table cell element (Since: 1.10.11)
         * Any element which has a data-dt-row attribute assigned to it, or a parent (Since: 1.10.11). This can be used by extensions such as FixedColumns and Responsive to allow easy row selection.
         * function - Function selector (Since: 1.10.3)
         * jQuery - jQuery object of row nodes
         * array - Array containing any combination of the above options
         * plainObject - 根据对象选择row e.g {id:4,name:3}
         *
         */
        getRow : function(selector){
            if($.isPlainObject(selector)){
                return this.dt.row(function(idx,data,node){
                    var pass = true;
                    $.each(selector,function(key,val){
                        pass = pass&&data[key] === val;
                    });
                    return pass;
                });
            }else{
                return this.dt.row(selector);
            }
        },
        /**
         * 优化方法，仅支持row-id-selector 不用方法dom，性能比较好
         * @param id
         * @returns {*}
         */
        getRowByID : function(id){
            return this.getRow("#"+id);
        },
        getRows : function(selector){
            return this.dt.rows(selector);
        },
        /**
         * 允许多选模式 获得选择的行
         */
        getCheckedRows : function(){
            if(this.checkMode){
                return this.dt.rows(function(idx,data,tr){
                    var check = $(tr).find("td:first :checkbox");
                    return !!check.prop("checked");
                });
            }
            return null;
        },

        /**
         * 根据不同的选择器选择列
         * @param {string|Object|function} selector -
         *
         * integer - Column entrance selector
         * {integer}:visIdx - Column visible entrance selector (e.g. 3:visIdx)
         * {integer}:visible - Alias of {integer}:visIdx.
         * {string}:name - Column name selector, from columns.name (e.g. salary:name)
         * string - jQuery selector
         * node - This may be one of the following:
         * th / td cell from the column headers
         * td / td cell from the table body (Since: 1.10.11)
         * Any element which has a data-dt-column attribute assigned to it, or a parent (Since: 1.10.11). This can be used by extensions such as FixedColumns and Responsive to allow easy column selection.
         * function - Function selector (Since: 1.10.3)
         * jQuery - jQuery object of the column header nodes
         * array - Array containing any combination of the above options
         *

         */
        getColumn : function(selector){
            return this.dt.column(selector)
        },

        getColumnByName:function(columnName){
            return this.getColumn(columnName+":name");
        },

        /**
         * 根据选择器选择单元格
         * @param {string|object|function} selector
         *  string - jQuery selector
         *  node - This may be one of the following:
         *  td / th cell
         *  Any element which has both a data-dt-row and data-dt-column attribute assigned to it, or a parent (Since: 1.10.11). This can be used by extensions such as FixedColumns and Responsive to allow easy column selection.
         *  function - Function selector (Since: 1.10.3)
         *  jQuery - jQuery object of cell nodes
         *  object - DataTables cell indexes (row and column properties)
         *  array - Array containing any combination of the above options
         * @returns {*}
         */
        getCells : function(selector){
            return this.dt.cells(selector);
        },

        /**
         *
         * @param rowSelector 参照getRow
         * @param columnSelector 参照getColumn
         */
        getCell : function(rowSelector,columnSelector){
            return this.dt.cell(rowSelector,columnSelector);
        },

        getCellByIdAndColumnName : function(id,columnName){
            return this.getCell(function( idx, data, node){
                return data.id === id;
            },columnName+":name");
        },

        /**
         * 选中row-执行CSS变色操作
         * @param jQuery|row-select-str@Datable
         */
        selectRow : function(row){
            if(zui.isJQDom(row)){
                row.addClass("selected").siblings(".selected").removeClass("selected");
            }else{
                var $row = this.dt.row(row).nodes().to$();
                if(zui.isJQDom($row)){
                    $row.addClass("selected").siblings(".selected").removeClass("selected");
                }else{
                    throw new Error("parameter invalid @ zui-table.selectRow!");
                }

            }
        },

        /**
         * 优化方法，根据ID选择行。
         * @param id
         */
        selectRowByID : function(id){
            this.getRowByID(id).nodes().to$().addClass("selected").siblings(".selected").removeClass("selected");
        },

        unSelectAll : function(){
            this.getRow(".selected").nodes().to$().removeClass("selected");
        },


        /**
         * 添加table数据操作的监听器
         * @param eventName 相应事件的名称=table中按钮的data-op属性
         * @param callback 注册的处理函数 接受两个参数isBatch-是否为批量操作，data-对应操作的数据对象（如果是批量操作，这里返回的是一个对象值集合）
         */
        addOperationListener : function(eventName, callback){
            if($.isFunction(callback)){
                this.operationListener[eventName] = callback;
            }
        },

        /**
         * 前置列表查询监听器。在按给定条件执行前执行
         * @param callback 执行的回调函数。callback可以有返回值。如果返回值是false将阻止查询，callback如果返回Deferred对象，将有该对象的结果决定是否查询
         */
        preSearch : function(callback){
            this.searchListener.preSearch = callback;
        },

        /**
         * 后置列表查询监听器。完成数据查询后执行callback
         * @param callback
         */
        postSearch :function(callback){
            this.searchListener.postSearch = callback;
        },

        /**
         * 前置清空查询监听器。完成清空条件前执行
         * @param callback 执行的回调函数。callback可以有返回值。如果返回值是false将阻止重置列表，callback如果返回Deferred对象，将有该对象的结果决定是否重置列表
         */
        preReset : function(callback){
            this.searchListener.preReset = callback;
        },

        /**
         * 后置清空查询监听器.完成清空条件后执行
         */
        postReset : function(callback){
            this.searchListener.postReset = callback;
        },

        /**
         * 根据checked的情况获取排序调整了的对象
         * {id:xxx,sortValue:xxx} sortValue为调整后的值，他的名字由用哪个列排序决定，默认是sortValue.
         */
        getNeedSortedData : function(){
            var table = this;
            var result =  [];
            if(!!this.sortValue&&this.sortValue==="input"){
                var sortColumn = this.getColumnByName(table.sortVar);
                if(sortColumn.length!==0){
                    var origin = sortColumn.data();
                    sortColumn.nodes().to$().each(function(idx){
                        var sortInput = $(this).children("input.sortColumn");
                        if(sortInput.prop("value")!==origin[idx].toString()){
                            var changedItem = {id:sortInput.data("rowid")};
                            changedItem[table.sortVar] = sortInput.prop("value");
                            result.push(changedItem);
                        }
                    })
                }
            }
            if(result.length!==0){
                return result;
            }
            return null;
        }
    };
}));


