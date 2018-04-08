/**
 * Created by 张未然 on 2016/8/22.
 */

;(function(factory){
    if(typeof define === 'function' && define.amd ){
        //以AMD模式加载，RequireJS中用。
        define(['jquery','zuiFrame'],factory);
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
    ZUI.prototype.buildList = function($listContainer,settings,serverURL,$searchContaner,selectedItem){
        if(!this.isJQDom($listContainer)){
            console.error("listContainer is not containing any DOM elements!");
            return;
        }
        if(this.isEmptyStr(serverURL)){
            console.error("serverURL can not be null!");
            return;
        }
        var zuilist = new ZUIList($listContainer,settings,serverURL,selectedItem);


        return zuilist;
    };

    var ZUIList = function($listContainer,settings,serverURL,selectedItem){
        this.opts = $.extend({},listDefault,settings);
        this.serverURL = serverURL;
        this.listData = null;
        this.$container = $listContainer;
        this._init(selectedItem);
        this.selectFun = null;
    };

    ZUIList.prototype = {
        _init : function(selectedItem){
            var that = this;
            zui.communicate(this.serverURL).done(function(data){
                if($.isEmptyObject(data)||$.isEmptyObject(data.list)) return;
                that.listData = data.list;
                var constructList = [];
                $.each(that.listData,function(index,item){
                    var listItemStr;
                    if(selectedItem!==undefined&&selectedItem!==null&&selectedItem==item.id){
                        listItemStr = '<a href="'+item.id+'" class="selected">'+item.name+'</a>'
                    }else{
                        listItemStr = '<a href="'+item.id+'">'+item.name+'</a>';
                    }
                    constructList[index] = listItemStr;
                });
                var listStr = constructList.join('');
                that.$container.html(listStr);
                registerListener();
            });
            function registerListener(){
                that.$container.on('click.zui','a',function(e){
                   e.preventDefault();
                   var $selectedItem = $(this).siblings(".selected");
                   if(!$(this).is($selectedItem)){
                       that.$container.trigger('listSelected.zui',{'item':$(this).attr("href")});
                       if(that.selectFun!==null){
                           that.selectFun({'item':$(this).attr("href")});
                       }
                       $selectedItem.removeClass("selected");
                       $(this).addClass("selected");
                   }
                });
            }
        },
        selectItem : function(id){
            this.$container.children("a").each(function(){
                if($(this).attr('href')===id){
                    $(this).addClass('selected').siblings().removeClass("selected");
                    if(that.selectFun!==null){
                        that.selectFun({'item':$(this).attr("href")});
                    }
                    return false;
                }
            });
        },
        onSelect : function(func){
            if($.isFunction(func)){
                this.selectFun = func;
            }
        }
    };

    var listDefault = {

    }




}));