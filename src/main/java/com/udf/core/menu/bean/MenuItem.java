package com.udf.core.menu.bean;


import javax.xml.bind.annotation.*;
import java.util.List;

/**
 * Created by zwr on 2014/12/16.
 */
@XmlType(propOrder = {"id","name","uri","icon","subMenus"})
@XmlAccessorType(XmlAccessType.FIELD)
public class MenuItem {

    @XmlAttribute
    private String id;
    @XmlAttribute
    private String name;
    @XmlAttribute
    private String uri;
    @XmlAttribute
    private String icon;
    @XmlAttribute
    private String roleLevel;

    @XmlElementWrapper(name="SubMenus")
    @XmlElement(name = "MenuItem")
    private List<MenuItem> subMenus;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
    }

    @Override
    public String toString() {
        String s = "name:"+name+" uri:"+uri+" icon:"+icon;
        return s;
    }

    public List<MenuItem> getSubMenus() {
        return subMenus;
    }

    public void setSubMenus(List<MenuItem> subMenus) {
        this.subMenus = subMenus;
    }

    public String getRoleLevel() {
        return roleLevel;
    }

    public void setRoleLevel(String roleLevel) {
        this.roleLevel = roleLevel;
    }
}
