package com.udf.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

import javax.servlet.http.HttpServletRequest;

/**
 * Created by ��δȻ on 2015/8/8.
 */
@Controller
public class pageController {

    @RequestMapping("/{url}")
    public String index(@PathVariable String url){
        return "index";
    }


    @RequestMapping("/zUIC/*")
    public void zUIC(HttpServletRequest request,Model model){
        String basePath = request.getContextPath();
        System.out.println("sdf:++++++"+basePath+"/res/zUIC");
        model.addAttribute("res",basePath+"/res/zUIC");
//      return "/zUIC/"+url;
    }



}
