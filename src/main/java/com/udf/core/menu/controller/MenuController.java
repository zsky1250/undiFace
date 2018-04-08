package com.udf.core.menu.controller;

import com.udf.core.menu.service.MenuService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.HashMap;

/**
 * Created by zwr on 2014/12/19.
 */

@Controller
@RequestMapping(value = "/*/")
public class MenuController {

    @Autowired
    private MenuService menuService;

    @RequestMapping(value = "menu")
    public void getMenu(Model model) {
        model.addAttribute("menu",menuService.getMenu());
    }
}
