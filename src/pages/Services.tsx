import { Link } from "react-router-dom";
import { Cog, Wrench, Package, TrendingUp, ArrowRight, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import customPartsImg from "@/assets/custom-parts.jpg";
import prototypeImg from "@/assets/prototype-design.jpg";
import turnkeyImg from "@/assets/turnkey-solutions.jpg";
import capabilitiesImg from "@/assets/capabilities-bg.jpg";

const Services = () => {
  const services = [
    {
      icon: Cog,
      title: "Custom Manufacturing Projects",
      description: "Complete manufacturing solutions tailored to your specific requirements, from initial concept through final production.",
      image: capabilitiesImg,
      features: [
        "Project planning and consultation",
        "Design for manufacturability review",
        "Quality assurance throughout production",
        "On-time delivery guarantee",
        "Full project documentation",
      ],
    },
    {
      icon: Wrench,
      title: "Prototype Design & Development",
      description: "Transform your ideas into functional prototypes with our rapid prototyping capabilities and engineering expertise.",
      image: prototypeImg,
      features: [
        "3D CAD modeling and design",
        "Rapid prototyping services",
        "Design iteration support",
        "Material selection guidance",
        "Testing and validation",
      ],
    },
    {
      icon: Package,
      title: "Custom Parts & Assemblies",
      description: "Precision-manufactured components and assemblies engineered to meet your exact specifications and quality standards.",
      image: customPartsImg,
      features: [
        "CNC machining capabilities",
        "Multi-axis manufacturing",
        "Tight tolerance production",
        "Material versatility",
        "Assembly and integration services",
      ],
    },
    {
      icon: TrendingUp,
      title: "Turnkey Solutions",
      description: "End-to-end manufacturing partnerships covering the entire product lifecycle from design to delivery.",
      image: turnkeyImg,
      features: [
        "Complete lifecycle management",
        "Supply chain coordination",
        "Quality control systems",
        "Logistics and delivery",
        "Post-delivery support",
      ],
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

      {/* Services Detail */}
      <section className="section-spacing bg-background">
        <div className="container-custom space-y-20">
          {services.map((service, index) => {
            const Icon = service.icon;
            const isEven = index % 2 === 0;
            
            return (
              <div key={index} className={`grid md:grid-cols-2 gap-12 items-center ${!isEven ? 'md:flex-row-reverse' : ''}`}>
                <div className={isEven ? 'md:order-1' : 'md:order-2'}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <h2 className="text-3xl font-bold">{service.title}</h2>
                  </div>
                  <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                    {service.description}
                  </p>
                  <div className="space-y-3 mb-6">
                    {service.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button asChild>
                    <Link to="/contact">
                      Request a Quote <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className={isEven ? 'md:order-2' : 'md:order-1'}>
                  <img
                    src={service.image}
                    alt={service.title}
                    className="rounded-lg shadow-2xl w-full"
                  />
                </div>
              </div>
            );
          })}
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
