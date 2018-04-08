package com.udf.controller;

import com.udf.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.ArrayList;
import java.util.List;

@Controller
public class ExampleUserController {

    @RequestMapping("/zUIC/user/{id}")
    public void getSingleUser(@PathVariable("id") Long userID, Model model){
        model.addAttribute("item",makeUser(userID));
    }


    @RequestMapping(value = "/zUIC/user/userList")
    public void listUser(Pageable page, @RequestParam(value = "draw") int draw, Model model){
        draw++;
        model.addAttribute("tableList",prepareUser(page));
    }

    private Page<User> prepareUser(Pageable page) {
        int size = page.getPageSize();
        int start = size*page.getPageNumber();
        List<User> users = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            users.add(makeUser((long) (i+start)));
        }
        Page<User> result = new PageImpl<User>(users,page,100);
        return result;
    }


    private User makeUser(Long id){
        User u = new User();
        u.setId(id);
        u.setName("NAME"+id);
        u.setAddress(id+"==地址斯蒂芬斯蒂芬斯蒂芬斯蒂芬斯蒂芬斯蒂芬");
        u.setUserName("张三"+id);
        return u;
    }

}
