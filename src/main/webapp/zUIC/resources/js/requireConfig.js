require.config({
    baseUrl:'resources/js',
    shim : {
        'zTree':{
            'deps':['jquery'],
            'exports':'jQuery.fn.zTree'
        },
        'bvForm':{
            'deps':['jquery'],
            'exports':'jQuery.fn.bootstrapValidator'
        },
        // 'zTree-exhide':{
        //     'deps':['zTree-core'],
        //     'exports':'jQuery.fn.zTree'
        // },
        'ckeditor-jquery':{
            'deps':['jquery','ckeditor-core','ckfinder'],
        }
    },
    paths : {
        "jquery":"jquery-1.12.4",
        "jqueryTransit":"jquery.transit",
        "zuiFrame":"zui-frame",
        "zuiTree":"zui-tree",
        "zuiList":"zui-list",
        "zuiForm":"zui-form",
        "zTree":"jquery.ztree.core",
        'bvForm':"bootstrapValidator-all",
        "datePicker":"bootstrap-datepicker",
        "zuiTable":"zui-table",
        "dataTables":"jquery.dataTables",
        "dtBootstrap":"dataTables.bootstrap",
        "zuiFormDialog":"zui-formDialog",
    },

});


