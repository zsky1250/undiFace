package com.udf.core.web.freemarker;

import org.springframework.web.servlet.view.freemarker.FreeMarkerView;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

public class ZuiFreeMarkerView  extends FreeMarkerView {


    /**
     * 部署路径名
     */
    private final String CONTEXT_PATH = "CONTEXT";
    private final String PAGE_PATH = "PAGE";
    private final String RESOURCE_PATH = "RES";



    /**
     * 在model中增加基础变量
     * 参数中必须使用Map
     */
    protected void exposeHelpers(Map<String, Object> model, HttpServletRequest request) throws Exception {
        String basePath = request.getContextPath();
        String module = (String) model.get("module");
        String contextPath = basePath + "/" + module;
        String pagePath = contextPath+ "/page";
        model.put(CONTEXT_PATH, basePath);
        model.put(PAGE_PATH, pagePath);
        model.put(RESOURCE_PATH, contextPath+"/"+"resources");
        model.put("WEB_TITLE","交通管理支队-综合业务收费系统");
        //model.put(TIME_FORMAT, new DateUtils());
        //页面可能用到的系统变量
//        model.put("currentUser",SecurityUtil.getCurrentUser());
//        model.put("coreVersion",configService.getConfig("coreVersion"));
//        model.put("DBVersion",configService.getConfig("DBVersion"));
    }

}