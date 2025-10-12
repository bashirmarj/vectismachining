import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Shield, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export default function AdminSetup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    checkForAdmins();
  }, []);

  const checkForAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (error) throw error;

      setAdminExists(data && data.length > 0);
    } catch (error) {
      console.error('Error checking for admins:', error);
      toast({
        title: "Error",
        description: "Failed to check admin status",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const promoteToAdmin = async () => {
    if (!user) return;

    setPromoting(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'admin'
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "You are now an admin",
      });

      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } catch (error: any) {
      console.error('Error promoting to admin:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to promote to admin",
        variant: "destructive",
      });
    } finally {
      setPromoting(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-16 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Admin Setup</CardTitle>
            <CardDescription>
              {adminExists 
                ? "Admin account already configured"
                : "Set up the first admin account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!user ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please sign in or create an account first
                </p>
                <Button onClick={() => navigate('/auth')} className="w-full">
                  Go to Sign In
                </Button>
              </div>
            ) : adminExists ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  An admin account has already been set up. If you're an admin, you can access the dashboard.
                </p>
                <Button onClick={() => navigate('/admin')} className="w-full">
                  Go to Admin Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Email:</strong> {user.email}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Click the button below to become the first admin of this application.
                </p>
                <Button 
                  onClick={promoteToAdmin} 
                  disabled={promoting}
                  className="w-full"
                >
                  {promoting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Promoting...
                    </>
                  ) : (
                    "Become Admin"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
