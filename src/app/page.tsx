'use client';

import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/contact-form";
import { CompanyContactForm } from "@/components/company-contact-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Briefcase, Mail, Zap, Book } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 lg:p-8 selection:bg-primary/20">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-bold text-primary flex items-center justify-center">
          <Zap className="w-12 h-12 mr-3 text-accent" />
          FLOCCI API HUB
      </h1>
        <p className="text-xl text-muted-foreground mt-3 max-w-2xl">
          Connecting individuals and companies through intelligent APIs. A service by Flocci Technologies.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/api-docs">
              <Book className="w-4 h-4" />
              API Documentation
            </Link>
          </Button>
        </div>
      </header>

      <main className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <ContactForm />
        </Card>
        <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CompanyContactForm />
        </Card>
      </main>

      <footer className="mt-12 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} FLOCCI API HUB by Flocci Technologies. All rights reserved.</p>
        <p className="mt-1">Powered by Next.js, Supabase, and GenAI.</p>
      </footer>

      {/* Placeholder for Signup/Login buttons/links if needed in future */}
      {/* 
      <div className="mt-8 flex space-x-4">
        <Button variant="outline">Sign Up</Button>
        <Button>Login</Button>
      </div>
      */}
    </div>
  );
}
