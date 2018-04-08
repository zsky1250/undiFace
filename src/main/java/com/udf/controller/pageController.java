package com.udf.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import javax.servlet.http.HttpServletRequest;

/**
 * Created by ��δȻ on 2015/8/8.
 */
@Controller
public class pageController {

    @RequestMapping("/index")
    public void index(){
    }

    @RequestMapping("/zUIC/{pageName}")
    public String zUIC(HttpServletRequest request,@PathVariable("pageName") String pageName, Model model){
        String basePath = request.getContextPath();
        request.setAttribute("module","zUIC");
        return pageName;
    }

    @RequestMapping("/zUIC/old/{pageName}")
    public String zUICFrame(HttpServletRequest request,@PathVariable("pageName") String pageName, Model model){
        String basePath = request.getContextPath();
        request.setAttribute("module","zUIC");
        return "old/"+pageName;
    }

}
