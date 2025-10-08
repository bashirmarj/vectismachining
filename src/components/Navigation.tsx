import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Phone, ChevronDown, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  const navItems = [{
    name: "Home",
    path: "/"
  }, {
    name: "About",
    path: "/about",
    subItems: [{
      name: "Our Story",
      path: "/about#story"
    }, {
      name: "Team",
      path: "/about#team"
    }, {
      name: "Quality Standards",
      path: "/about#quality"
    }]
  }, {
    name: "Services",
    path: "/services",
    subItems: [{
      name: "Prototype Design",
      path: "/services/prototype-design"
    }, {
      name: "Custom Parts & Assemblies",
      path: "/services/custom-parts"
    }, {
      name: "Prototyping Services",
      path: "/services/prototyping"
    }, {
      name: "Turnkey Solutions",
      path: "/services/turnkey-solutions"
    }]
  }, {
    name: "Capabilities",
    path: "/capabilities",
    subItems: [{
      name: "CNC Machining",
      path: "/capabilities#cnc"
    }, {
      name: "Precision Engineering",
      path: "/capabilities#precision"
    }, {
      name: "Quality Control",
      path: "/capabilities#quality"
    }]
  }, {
    name: "Projects",
    path: "/projects",
    subItems: [{
      name: "Case Studies",
      path: "/projects#case-studies"
    }, {
      name: "Portfolio",
      path: "/projects#portfolio"
    }]
  }, {
    name: "Contact",
    path: "/contact"
  }];
  const isActive = (path: string) => location.pathname === path;
  return <nav className="fixed top-0 left-0 right-0 z-50 bg-accent/95 backdrop-blur-sm border-b border-border">
      <div className="container-custom">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">VM</span>
            </div>
            <span className="text-2xl font-bold text-primary-foreground">VECTIS</span>
          </Link>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              {navItems.map(item => <NavigationMenuItem key={item.path}>
                  {item.subItems ? <>
                      <NavigationMenuTrigger className={`!bg-transparent ${isActive(item.path) ? "text-primary !bg-primary/10" : "text-accent-foreground hover:text-primary hover:!bg-primary/5"}`}>
                        {item.name}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] bg-accent border border-border shadow-lg z-50">
                          {item.subItems.map(subItem => <li key={subItem.path}>
                              <NavigationMenuLink asChild>
                                <Link to={subItem.path} className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors text-accent-foreground hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary">
                                  <div className="text-sm font-medium leading-none">{subItem.name}</div>
                                </Link>
                              </NavigationMenuLink>
                            </li>)}
                        </ul>
                      </NavigationMenuContent>
                    </> : <Link to={item.path} className={`inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary focus:outline-none disabled:pointer-events-none disabled:opacity-50 ${isActive(item.path) ? "text-primary bg-primary/10" : "text-primary-foreground"}`}>
                      {item.name}
                    </Link>}
                </NavigationMenuItem>)}
            </NavigationMenuList>
          </NavigationMenu>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <a href="tel:+1234567890" className="flex items-center space-x-2 text-primary-foreground hover:text-primary transition-colors">
              <Phone className="h-4 w-4" />
              <span className="font-semibold">437-433-6300</span>
            </a>
            <Button asChild>
              <Link to="/contact">Get Quote</Link>
            </Button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    Admin Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-primary-foreground p-2" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col space-y-2">
              {navItems.map(item => <div key={item.path}>
                  <Link to={item.path} onClick={() => setIsOpen(false)} className={`flex items-center justify-between px-4 py-3 rounded-md text-sm font-semibold transition-colors ${isActive(item.path) ? "text-primary bg-primary/10" : "text-primary-foreground hover:text-primary hover:bg-primary/5"}`}>
                    {item.name}
                  </Link>
                  {item.subItems && <div className="ml-4 mt-2 space-y-2">
                      {item.subItems.map(subItem => <Link key={subItem.path} to={subItem.path} onClick={() => setIsOpen(false)} className="block px-4 py-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                          {subItem.name}
                        </Link>)}
                    </div>}
                </div>)}
              <div className="pt-4 px-4 space-y-3">
                <a href="tel:+1234567890" className="flex items-center space-x-2 text-primary-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="font-semibold">(123) 456-7890</span>
                </a>
                <Button asChild className="w-full">
                  <Link to="/contact">Get Quote</Link>
                </Button>
              </div>
            </div>
          </div>}
      </div>
    </nav>;
};
export default Navigation;