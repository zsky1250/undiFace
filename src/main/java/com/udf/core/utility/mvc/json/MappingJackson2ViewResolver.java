package com.udf.core.utility.mvc.json;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.servlet.View;
import org.springframework.web.servlet.ViewResolver;
import org.springframework.web.servlet.view.json.MappingJackson2JsonView;

import java.util.Locale;

/**
 * Created by zwr on 2014/12/18.
 * jsonViewRecolver主要服务于contentNegotiatiingViewReslover 配置以后可以根据页面请求，来分辨需要什么内容
 * controller里可以不用@responseBody。
 * 请求的时候写url.json.然后把对象放到Model里即可。如model.put("ss",object);
 */

public class MappingJackson2ViewResolver implements ViewResolver {

    private static Logger log = LoggerFactory.getLogger(MappingJackson2ViewResolver.class);

    public MappingJackson2JsonView getView() {
        return view;
    }

    public void setView(MappingJackson2JsonView view) {
        this.view = view;
    }

    private MappingJackson2JsonView view;



    @Override
    public View resolveViewName(String viewName, Locale locale) throws Exception {
        if(view==null){
            view = new MappingJackson2JsonView();
            log.debug("未发现注入view，填充默认的view：{}",view.getClass());
        }
        return view;
    }
}
