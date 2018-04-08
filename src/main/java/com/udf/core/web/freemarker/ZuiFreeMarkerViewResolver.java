package com.udf.core.web.freemarker;

import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.view.AbstractTemplateViewResolver;

import java.util.Locale;
import java.util.Map;

public class ZuiFreeMarkerViewResolver extends AbstractTemplateViewResolver { private String prefix = "";

    private String suffix = "";

    private Class<?> viewClass;

    public Class<?> getViewClass() {
        return viewClass;
    }

    public void setViewClass(Class<?> viewClass) {
        this.viewClass = viewClass;
    }

    public ZuiFreeMarkerViewResolver() {
        this.viewClass = ZuiFreeMarkerView.class;
    }

    @Override
    protected String getPrefix() {
        ServletRequestAttributes requestAttributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        Object module =requestAttributes.getRequest().getAttribute("module");
        if(!StringUtils.isEmpty(module)){
            return "/"+module+"/pages/";
        }
        return this.prefix;
    }

    @Override
    public void setPrefix(String prefix) {
        this.prefix = (prefix != null ? prefix : "");
    }

    @Override
    protected String getSuffix() {
        return this.suffix;
    }

    @Override
    public void setSuffix(String suffix) {
        this.suffix = (suffix != null ? suffix : "");
    }


    @Override
    protected Object getCacheKey(String viewName, Locale locale) {
        String moduleKey = "";
        ServletRequestAttributes requestAttributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        Object module =requestAttributes.getRequest().getAttribute("module");
        if(!StringUtils.isEmpty(module)){
            moduleKey=module+"_";
        }
        return moduleKey+viewName + "_" + locale;
    }
}
