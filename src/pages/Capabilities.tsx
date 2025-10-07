import { Link } from "react-router-dom";
import { Settings, PenTool, Award, Shield, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import capabilitiesImg from "@/assets/capabilities-bg.jpg";

const Capabilities = () => {
  const capabilities = [
    {
      icon: Settings,
      title: "Advanced CNC Machining",
      description: "State-of-the-art multi-axis CNC equipment for complex geometries and tight tolerances",
      specs: [
        "5-axis CNC milling",
        "High-precision turning",
        "Tolerance to ±0.0005\"",
        "Materials: metals, plastics, composites",
      ],
    },
    {
      icon: PenTool,
      title: "CAD/CAM Engineering",
      description: "Sophisticated design and programming capabilities for optimal manufacturing efficiency",
      specs: [
        "3D modeling and simulation",
        "DFM analysis and optimization",
        "Reverse engineering services",
        "Toolpath optimization",
      ],
    },
    {
      icon: Award,
      title: "Quality Assurance",
      description: "Comprehensive inspection and testing ensuring every component meets specifications",
      specs: [
        "CMM inspection",
        "In-process quality control",
        "Material certification",
        "Full dimensional reports",
      ],
    },
    {
      icon: Shield,
      title: "Material Expertise",
      description: "Extensive experience working with diverse materials for any application",
      specs: [
        "Aluminum alloys",
        "Stainless steel",
        "Titanium",
        "Engineering plastics",
      ],
    },
  ];

  const technologies = [
    "CNC Milling (3, 4, and 5-axis)",
    "CNC Turning & Swiss Screw Machining",
    "Wire EDM & Sinker EDM",
    "Surface Grinding",
    "Sheet Metal Fabrication",
    "Welding & Assembly",
    "Powder Coating & Finishing",
    "Quality Inspection Systems",
  ];

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${capabilitiesImg})` }}
        >
          <div className="absolute inset-0 hero-gradient opacity-90"></div>
        </div>
        
        <div className="container-custom relative z-10 pt-20">
          <div className="max-w-3xl">
            <h1 className="text-white mb-6">Manufacturing Capabilities</h1>
            <p className="text-xl text-gray-200 leading-relaxed">
              Advanced manufacturing technology combined with expert craftsmanship to deliver precision components and assemblies.
            </p>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="section-spacing bg-background">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="mb-4">Core Manufacturing Capabilities</h2>
            <p className="text-lg text-muted-foreground">
              Cutting-edge equipment and proven processes delivering exceptional results.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {capabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <Card key={index} className="border-2 hover:shadow-xl transition-shadow">
                  <CardContent className="p-8">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="h-7 w-7 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-2">{capability.title}</h3>
                        <p className="text-muted-foreground">{capability.description}</p>
                      </div>
                    </div>
                    <ul className="space-y-2 ml-[72px]">
                      {capability.specs.map((spec, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                          {spec}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technologies */}
      <section className="section-spacing bg-muted">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="mb-4">Technologies & Equipment</h2>
            <p className="text-lg text-muted-foreground">
              Our facility is equipped with the latest manufacturing technology to handle projects of any complexity.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {technologies.map((tech, index) => (
              <div
                key={index}
                className="bg-background rounded-lg p-6 font-semibold text-center hover:bg-primary hover:text-primary-foreground transition-colors border-2 border-border"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facility Stats */}
      <section className="section-spacing bg-background">
        <div className="container-custom">
          <div className="bg-accent rounded-2xl p-12 text-center">
            <h2 className="mb-12 text-white">Our Facility</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <div className="text-4xl font-bold text-primary mb-2">40,000</div>
                <div className="text-gray-200">Sq. Ft. Facility</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">50+</div>
                <div className="text-gray-200">CNC Machines</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">24/7</div>
                <div className="text-gray-200">Production Capability</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">ISO</div>
                <div className="text-gray-200">9001 Certified</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Materials Section */}
      <section className="section-spacing bg-muted">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="mb-8 text-center">Material Capabilities</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold mb-4">Metals</h3>
                <ul className="space-y-2">
                  {[
                    "Aluminum (6061, 7075, etc.)",
                    "Stainless Steel (304, 316, etc.)",
                    "Titanium",
                    "Brass & Copper",
                    "Tool Steel",
                    "Carbon Steel",
                  ].map((material, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      {material}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4">Plastics & Composites</h3>
                <ul className="space-y-2">
                  {[
                    "ABS",
                    "Delrin (Acetal)",
                    "PEEK",
                    "Nylon",
                    "Polycarbonate",
                    "PTFE (Teflon)",
                  ].map((material, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      {material}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-spacing bg-accent text-accent-foreground">
        <div className="container-custom text-center">
          <h2 className="mb-4 text-white">Put Our Capabilities to Work</h2>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Discuss your project requirements with our engineering team and discover how we can deliver exceptional results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/contact">
                Request a Quote <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline-light" asChild>
              <Link to="/services">View Services</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Capabilities;
