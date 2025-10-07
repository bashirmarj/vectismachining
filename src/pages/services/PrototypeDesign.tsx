import { Link } from "react-router-dom";
import { Wrench, ArrowRight, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import prototypeImg from "@/assets/prototype-design.jpg";

const PrototypeDesign = () => {
  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-accent text-accent-foreground overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center"
          style={{ backgroundImage: `url(${prototypeImg})` }}
        ></div>
        <div className="container-custom relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
              <Wrench className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-white mb-0">Prototype Design & Development</h1>
          </div>
          <p className="text-xl text-gray-200 leading-relaxed max-w-3xl">
            Transform your ideas into functional prototypes with our rapid prototyping capabilities and engineering expertise.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="section-spacing bg-background">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="md:order-2">
              <img
                src={prototypeImg}
                alt="Prototype Design & Development"
                className="rounded-lg shadow-2xl w-full mb-8"
              />
            </div>
            <div className="md:order-1">
              <h2 className="mb-6">Rapid Prototyping Excellence</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Bring your concepts to life with our comprehensive prototype design and development services. 
                We combine advanced CAD modeling with rapid prototyping technologies to iterate quickly and 
                efficiently, ensuring your design is optimized before moving to production.
              </p>
              
              <h3 className="text-xl font-bold mb-4">Key Features</h3>
              <div className="space-y-3 mb-8">
                {[
                  "3D CAD modeling and design",
                  "Rapid prototyping services",
                  "Design iteration support",
                  "Material selection guidance",
                  "Testing and validation",
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              <Button size="lg" asChild>
                <Link to="/contact">
                  Request a Quote <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrototypeDesign;
