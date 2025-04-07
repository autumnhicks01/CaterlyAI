'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';

interface ProfileGeneratorProps {
  profileId?: string;
  initialData?: any;
  onComplete?: (result: any) => void;
}

export default function ProfileGenerator({ profileId, initialData, onComplete }: ProfileGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: profileId || '',
    businessName: initialData?.businessName || '',
    location: initialData?.location || '',
    serviceRadius: initialData?.serviceRadius || '',
    yearsInOperation: initialData?.yearsInOperation || '',
    idealClients: initialData?.idealClients || '',
    signatureDishesOrCuisines: initialData?.signatureDishesOrCuisines || '',
    uniqueSellingPoints: initialData?.uniqueSellingPoints || '',
    brandVoiceAndStyle: initialData?.brandVoiceAndStyle || '',
    testimonialsOrAwards: initialData?.testimonialsOrAwards || '',
    contactInformation: initialData?.contactInformation || {
      phone: '',
      email: '',
      website: '',
      socialMedia: []
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const generateProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate profile');
      }
      
      if (onComplete) {
        onComplete(data.result);
      }
      
      return data.result;
    } catch (err) {
      console.error('Error generating profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Generate Catering Business Profile</CardTitle>
        <CardDescription>
          Enter your business details to generate an AI-enhanced profile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name*</Label>
          <Input
            id="businessName"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            placeholder="Enter your business name"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="location">Location*</Label>
          <Input
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="City, State"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="serviceRadius">Service Area</Label>
          <Input
            id="serviceRadius"
            name="serviceRadius"
            value={formData.serviceRadius}
            onChange={handleChange}
            placeholder="e.g., 50 mile radius from Atlanta"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="yearsInOperation">Years in Business</Label>
          <Input
            id="yearsInOperation"
            name="yearsInOperation"
            value={formData.yearsInOperation}
            onChange={handleChange}
            placeholder="e.g., 5 years"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="signatureDishesOrCuisines">Signature Dishes/Cuisines</Label>
          <Textarea
            id="signatureDishesOrCuisines"
            name="signatureDishesOrCuisines"
            value={formData.signatureDishesOrCuisines}
            onChange={handleChange}
            placeholder="List your signature dishes or cuisine specialties"
            rows={3}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="idealClients">Ideal Clients</Label>
          <Textarea
            id="idealClients"
            name="idealClients"
            value={formData.idealClients}
            onChange={handleChange}
            placeholder="Describe your ideal clients or events"
            rows={3}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="uniqueSellingPoints">Unique Selling Points</Label>
          <Textarea
            id="uniqueSellingPoints"
            name="uniqueSellingPoints"
            value={formData.uniqueSellingPoints}
            onChange={handleChange}
            placeholder="What makes your catering business unique?"
            rows={3}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="contactInformation.email">Email</Label>
          <Input
            id="contactInformation.email"
            name="contactInformation.email"
            value={formData.contactInformation.email}
            onChange={handleChange}
            placeholder="contact@yourbusiness.com"
            type="email"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="contactInformation.phone">Phone</Label>
          <Input
            id="contactInformation.phone"
            name="contactInformation.phone"
            value={formData.contactInformation.phone}
            onChange={handleChange}
            placeholder="(555) 123-4567"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-red-500">{error}</div>
        <Button 
          onClick={generateProfile} 
          disabled={loading || !formData.businessName || !formData.location}
        >
          {loading ? 'Generating...' : 'Generate Profile'}
        </Button>
      </CardFooter>
    </Card>
  );
} 