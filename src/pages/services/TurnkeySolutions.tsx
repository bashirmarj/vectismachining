import { Link } from "react-router-dom";
import { TrendingUp, ArrowRight, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import turnkeyImg from "@/assets/turnkey-solutions.jpg";

const TurnkeySolutions = () => {
  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-accent text-accent-foreground overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center"
          style={{ backgroundImage: `url(${turnkeyImg})` }}
        ></div>
        <div className="container-custom relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-white mb-0">Turnkey Solutions</h1>
          </div>
          <p className="text-xl text-gray-200 leading-relaxed max-w-3xl">
            End-to-end manufacturing partnerships covering the entire product lifecycle from design to delivery.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="section-spacing bg-background">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <img
                src={turnkeyImg}
                alt="Turnkey Solutions"
                className="rounded-lg shadow-2xl w-full mb-8"
              />
            </div>
            <div>
              <h2 className="mb-6">Complete Lifecycle Management</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Our turnkey solutions provide a comprehensive approach to manufacturing, handling every aspect 
                of your product lifecycle. From initial design through production, logistics, and post-delivery 
                support, we're your complete manufacturing partner.
              </p>
              
              <h3 className="text-xl font-bold mb-4">Key Features</h3>
              <div className="space-y-3 mb-8">
                {[
                  "Complete lifecycle management",
                  "Supply chain coordination",
                  "Quality control systems",
                  "Logistics and delivery",
                  "Post-delivery support",
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

export default TurnkeySolutions;
