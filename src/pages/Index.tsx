import { Link } from "react-router-dom";
import { ArrowRight, Cog, Wrench, Package, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import heroImage from "@/assets/hero-manufacturing.jpg";
import customPartsImg from "@/assets/custom-parts.jpg";
import prototypeImg from "@/assets/prototype-design.jpg";
import turnkeyImg from "@/assets/turnkey-solutions.jpg";

const Index = () => {
  const services = [
    {
      icon: Cog,
      title: "Custom Manufacturing",
      description: "Precision manufacturing projects tailored to your exact specifications and requirements.",
      image: customPartsImg,
    },
    {
      icon: Wrench,
      title: "Prototype Design",
      description: "Transform your concepts into functional prototypes with our expert engineering team.",
      image: prototypeImg,
    },
    {
      icon: Package,
      title: "Custom Parts & Assemblies",
      description: "High-quality custom components manufactured to meet your specific application needs.",
      image: customPartsImg,
    },
    {
      icon: TrendingUp,
      title: "Turnkey Solutions",
      description: "Complete project lifecycle management from initial design through final delivery.",
      image: turnkeyImg,
    },
  ];

  const stats = [
    { value: "25+", label: "Years Experience" },
    { value: "500+", label: "Projects Completed" },
    { value: "98%", label: "Client Satisfaction" },
    { value: "50+", label: "Team Members" },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 hero-gradient opacity-90"></div>
        </div>
        
        <div className="container-custom relative z-10 pt-20">
          <div className="max-w-4xl">
            <p className="text-primary font-semibold text-lg mb-4 uppercase tracking-wide">
              Precision Manufacturing Excellence
            </p>
            <h1 className="text-foreground mb-6 text-white">
              Custom Manufacturing Solutions From Concept to Completion
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl leading-relaxed">
              Vectis delivers turnkey manufacturing projects, precision prototype designs, and custom parts engineered to perfection. We bring your vision to life with expert craftsmanship and cutting-edge technology.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link to="/contact">
                  Request a Quote <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline-light" asChild>
                <Link to="/capabilities">Explore Capabilities</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-accent/95 backdrop-blur-sm">
          <div className="container-custom py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="section-spacing bg-background">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="mb-4">Our Core Services</h2>
            <p className="text-lg text-muted-foreground">
              Comprehensive manufacturing solutions backed by decades of engineering expertise and state-of-the-art technology.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-2 overflow-hidden">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-accent/90 to-transparent"></div>
                    <div className="absolute bottom-4 left-4">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold mb-2">{service.title}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{service.description}</p>
                    <Link
                      to="/services"
                      className="text-primary font-semibold text-sm inline-flex items-center group-hover:gap-2 transition-all"
                    >
                      Learn More <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Vectis */}
      <section className="section-spacing bg-muted">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-6">Why Choose Vectis?</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-xl">1</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">End-to-End Solutions</h3>
                    <p className="text-muted-foreground">
                      From initial concept and design through manufacturing and final delivery, we manage your entire project lifecycle.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-xl">2</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Precision Engineering</h3>
                    <p className="text-muted-foreground">
                      State-of-the-art equipment and rigorous quality control ensure every part meets exact specifications.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-xl">3</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Expert Team</h3>
                    <p className="text-muted-foreground">
                      Our experienced engineers and technicians bring deep industry knowledge to every project.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <Button size="lg" asChild>
                  <Link to="/about">Learn About Us</Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <img
                src={turnkeyImg}
                alt="Manufacturing facility"
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-spacing bg-accent text-accent-foreground">
        <div className="container-custom text-center">
          <h2 className="mb-4 text-white">Ready to Start Your Project?</h2>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Let's discuss how Vectis can bring your manufacturing vision to life with precision and expertise.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/contact">
                Get a Quote <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline-light" asChild>
              <Link to="/projects">View Our Work</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
