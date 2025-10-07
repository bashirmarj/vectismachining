import { Link } from "react-router-dom";
import { Cog, Wrench, Package, TrendingUp, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import customPartsImg from "@/assets/custom-parts.jpg";
import prototypeImg from "@/assets/prototype-design.jpg";
import turnkeyImg from "@/assets/turnkey-solutions.jpg";
import capabilitiesImg from "@/assets/capabilities-bg.jpg";

const Services = () => {
  const services = [
    {
      icon: Wrench,
      title: "Prototype Design & Development",
      description: "Transform your ideas into functional prototypes with our rapid prototyping capabilities and engineering expertise.",
      image: prototypeImg,
      link: "/services/prototype-design",
    },
    {
      icon: Package,
      title: "Custom Parts & Assemblies",
      description: "Precision-manufactured components and assemblies engineered to meet your exact specifications and quality standards.",
      image: customPartsImg,
      link: "/services/custom-parts",
    },
    {
      icon: Wrench,
      title: "Prototyping Services",
      description: "Rapid prototyping solutions to bring your concepts to life quickly and efficiently for testing and validation.",
      image: prototypeImg,
      link: "/services/prototyping",
    },
    {
      icon: TrendingUp,
      title: "Turnkey Solutions",
      description: "End-to-end manufacturing partnerships covering the entire product lifecycle from design to delivery.",
      image: turnkeyImg,
      link: "/services/turnkey-solutions",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-accent text-accent-foreground overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center"
          style={{ backgroundImage: `url(${capabilitiesImg})` }}
        ></div>
        <div className="container-custom relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-white mb-6">Manufacturing Services</h1>
            <p className="text-xl text-gray-200 leading-relaxed">
              Comprehensive manufacturing solutions backed by cutting-edge technology and decades of engineering expertise.
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="section-spacing bg-background">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              
              return (
                <Card key={index} className="overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <CardTitle className="text-xl">{service.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-6">
                      {service.description}
                    </p>
                    <Button asChild className="w-full">
                      <Link to={service.link}>
                        Learn More <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="section-spacing bg-muted">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="mb-4">Our Manufacturing Process</h2>
            <p className="text-lg text-muted-foreground">
              A proven methodology ensuring quality, efficiency, and client satisfaction at every stage.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Consultation", desc: "Understanding your requirements and project goals" },
              { step: "02", title: "Design & Engineering", desc: "Creating detailed specifications and prototypes" },
              { step: "03", title: "Manufacturing", desc: "Precision production with quality oversight" },
              { step: "04", title: "Delivery & Support", desc: "On-time delivery with ongoing assistance" },
            ].map((phase, index) => (
              <Card key={index} className="border-2 relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="text-6xl font-bold text-primary/10 absolute -top-4 -right-4">
                    {phase.step}
                  </div>
                  <div className="relative z-10">
                    <div className="text-sm font-bold text-primary mb-2">STEP {phase.step}</div>
                    <h3 className="text-xl font-bold mb-2">{phase.title}</h3>
                    <p className="text-muted-foreground text-sm">{phase.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-spacing bg-accent text-accent-foreground">
        <div className="container-custom text-center">
          <h2 className="mb-4 text-white">Ready to Get Started?</h2>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Let's discuss your manufacturing needs and explore how Vectis can deliver the perfect solution.
          </p>
          <Button size="lg" asChild>
            <Link to="/contact">
              Contact Us Today <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Services;
