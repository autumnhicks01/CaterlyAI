import { Metadata } from 'next';
import ProfileGenerator from '@/components/profile-generator';

export const metadata: Metadata = {
  title: 'Catering Profile Generator | Mastra AI Profile',
  description: 'Generate a professional AI-enhanced profile for your catering business',
};

export default function ProfileGeneratorPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col items-center space-y-4 text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">AI Catering Profile Generator</h1>
        <p className="text-muted-foreground max-w-2xl">
          Enter your business details below to generate a professional, AI-enhanced profile for your catering business.
          Our system uses advanced AI to create a compelling description that highlights your unique selling points.
        </p>
      </div>
      
      <ProfileGenerator 
        onComplete={(result) => {
          // When profile generation is complete, redirect to the profile view page
          if (result?.savedProfile?.id) {
            window.location.href = `/profile/${result.savedProfile.id}`;
          }
        }}
      />
    </div>
  );
} 