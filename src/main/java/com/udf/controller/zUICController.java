package com.udf.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.ArrayList;

/**
 * Created by 张未然 on 2015/8/10.
 */
@Controller
public class zUICController {

    //ContentNegoation写法。等效于@ResponseBody
    @RequestMapping("/zUIC/subMenuList")
    public void getSubMenuListByTopMenu(String menuID,Model model){
        ArrayList<subMenu> subMenuList = new ArrayList<>();
        if(menuID.equals("aaa")){
            subMenu s1 = new subMenu();
            s1.href = "a1.html";
            s1.text = "a-组织结构";
            subMenu s2 = new subMenu();
            s2.href = "a2.html";
            s2.text = "a-人员管理";
            subMenu s3 = new subMenu();
            s3.href = "a3.html";
            s3.text = "a-其他管理";
            subMenuList.add(s1);
            subMenuList.add(s2);
            subMenuList.add(s3);
        }else if(menuID.equals("bbb")){
            subMenu s1 = new subMenu();
            s1.href = "b1.html";
            s1.text = "b-组织结构";
            subMenu s2 = new subMenu();
            s2.href = "b2.html";
            s2.text = "b-人员管理";
            subMenu s3 = new subMenu();
            s3.href = "b3.html";
            s3.text = "b-其他管理";
            subMenuList.add(s1);
            subMenuList.add(s2);
            subMenuList.add(s3);
        }else{
            subMenu s1 = new subMenu();
            s1.href = "c1.html";
            s1.text = "c-组织结构";
            subMenu s2 = new subMenu();
            s2.href = "c2.html";
            s2.text = "c-人员管理";
            subMenu s3 = new subMenu();
            s3.href = "c3.html";
            s3.text = "c-其他管理";
            subMenuList.add(s1);
            subMenuList.add(s2);
            subMenuList.add(s3);
        }
        model.addAttribute("subMenuList", subMenuList);
    }

    public class subMenu{
        String href;
        String text;

        public String getHref() {
            return href;
        }

        public void setHref(String href) {
            this.href = href;
        }

        public String getText() {
            return text;
        }

        public void setText(String text) {
            this.text = text;
        }
    }
}
