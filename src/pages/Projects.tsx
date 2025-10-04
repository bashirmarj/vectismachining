import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import customPartsImg from "@/assets/custom-parts.jpg";
import prototypeImg from "@/assets/prototype-design.jpg";
import turnkeyImg from "@/assets/turnkey-solutions.jpg";
import capabilitiesImg from "@/assets/capabilities-bg.jpg";

const Projects = () => {
  const projects = [
    {
      title: "Aerospace Component Manufacturing",
      category: "Aerospace",
      description: "Precision manufacturing of critical aerospace components with tight tolerances and full material traceability for a leading aerospace contractor.",
      image: customPartsImg,
      details: ["Material: Titanium Ti-6Al-4V", "Tolerance: ±0.0005\"", "Quantity: 5,000 units/year", "Certification: AS9100"],
    },
    {
      title: "Medical Device Prototype",
      category: "Medical",
      description: "Rapid prototyping and design iteration for an innovative surgical instrument, from concept to FDA-ready prototype in 6 weeks.",
      image: prototypeImg,
      details: ["Timeline: 6 weeks", "Iterations: 4 design cycles", "Material: 316L Stainless Steel", "Compliance: ISO 13485"],
    },
    {
      title: "Industrial Automation System",
      category: "Industrial",
      description: "Complete turnkey solution for custom automated assembly system, including design, manufacturing, integration, and commissioning.",
      image: turnkeyImg,
      details: ["Scope: End-to-end solution", "Timeline: 4 months", "Components: 200+ custom parts", "Result: 40% efficiency increase"],
    },
    {
      title: "Automotive Tooling & Fixtures",
      category: "Automotive",
      description: "Custom tooling and fixture manufacturing for high-volume automotive production line, ensuring consistent quality and reduced cycle time.",
      image: capabilitiesImg,
      details: ["Application: Production line", "Material: Tool Steel", "Durability: 1M+ cycles", "Delivery: On-time, on-budget"],
    },
    {
      title: "Defense Equipment Components",
      category: "Defense",
      description: "Classified component manufacturing for defense applications requiring highest precision and security clearance protocols.",
      image: customPartsImg,
      details: ["Classification: Restricted", "Quality: Zero defects", "Material: Various alloys", "Certification: ITAR compliant"],
    },
    {
      title: "Energy Sector Custom Parts",
      category: "Energy",
      description: "Large-scale manufacturing of custom components for renewable energy systems, supporting sustainable power generation.",
      image: turnkeyImg,
      details: ["Scale: High-volume", "Material: Corrosion-resistant", "Environment: Harsh conditions", "Longevity: 20+ years"],
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
            <h1 className="text-white mb-6">Our Projects</h1>
            <p className="text-xl text-gray-200 leading-relaxed">
              Showcasing our diverse manufacturing expertise across industries, from precision aerospace components to large-scale industrial solutions.
            </p>
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="section-spacing bg-background">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <Card key={index} className="group border-2 hover:shadow-2xl transition-all duration-300 overflow-hidden">
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-accent via-accent/50 to-transparent"></div>
                  <div className="absolute top-4 left-4">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                      {project.category}
                    </span>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-3">{project.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                    {project.description}
                  </p>
                  <div className="space-y-2 mb-4">
                    {project.details.map((detail, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <div className="w-1 h-1 bg-primary rounded-full mt-1.5 flex-shrink-0"></div>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Industries Served */}
      <section className="section-spacing bg-muted">
        <div className="container-custom">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="mb-4">Industries We Serve</h2>
            <p className="text-lg text-muted-foreground">
              Our versatile manufacturing capabilities support diverse sectors with specialized requirements.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {["Aerospace", "Medical", "Automotive", "Defense", "Energy", "Industrial"].map((industry) => (
              <div
                key={industry}
                className="bg-background rounded-lg p-6 text-center font-semibold hover:bg-primary hover:text-primary-foreground transition-colors border-2 border-border"
              >
                {industry}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Metrics */}
      <section className="section-spacing bg-background">
        <div className="container-custom">
          <div className="bg-accent rounded-2xl p-12 text-center">
            <h2 className="mb-4 text-white">Project Success Rate</h2>
            <p className="text-gray-200 mb-12 max-w-2xl mx-auto">
              Our commitment to excellence is reflected in measurable results across all projects.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <div className="text-4xl font-bold text-primary mb-2">98%</div>
                <div className="text-gray-200">On-Time Delivery</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
                <div className="text-gray-200">Quality Acceptance</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">500+</div>
                <div className="text-gray-200">Projects Completed</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">95%</div>
                <div className="text-gray-200">Repeat Customers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-spacing bg-muted">
        <div className="container-custom text-center">
          <h2 className="mb-4">Start Your Next Project</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Ready to bring your manufacturing project to life? Let's discuss your requirements and timeline.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/contact">
                Get a Quote <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/capabilities">View Capabilities</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Projects;
