import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Database client with typed collections
export const db = {
  /**
   * Profiles collection
   * 
   * Stores business profiles and their AI-enhanced versions
   */
  profiles: {
    // Create a new profile
    async create(profile: any) {
      const { error, data } = await supabase
        .from('profiles')
        .insert(profile)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Get a profile by ID
    async get(id: string) {
      const { error, data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Get all profiles for a user
    async getByUserId(userId: string) {
      const { error, data } = await supabase
        .from('profiles')
        .select('*')
        .eq('userId', userId);
      
      if (error) throw error;
      return data;
    },
    
    // Update a profile
    async update(id: string, updates: any) {
      const { error, data } = await supabase
        .from('profiles')
        .update({ ...updates, updatedAt: new Date() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Delete a profile
    async delete(id: string) {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    }
  },
  
  /**
   * Leads collection
   * 
   * Stores discovered and enhanced leads
   */
  leads: {
    // Create a new lead
    async create(lead: any) {
      const { error, data } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Get a lead by ID
    async get(id: string) {
      const { error, data } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Get all leads for a user
    async getByUserId(userId: string) {
      const { error, data } = await supabase
        .from('leads')
        .select('*')
        .eq('userId', userId);
      
      if (error) throw error;
      return data;
    },
    
    // Update a lead
    async update(id: string, updates: any) {
      const { error, data } = await supabase
        .from('leads')
        .update({ ...updates, updatedAt: new Date() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Delete a lead
    async delete(id: string) {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    }
  },
  
  /**
   * Campaigns collection
   * 
   * Stores marketing campaigns
   */
  campaigns: {
    // Create a new campaign
    async create(campaign: any) {
      const { error, data } = await supabase
        .from('campaigns')
        .insert(campaign)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Get a campaign by ID
    async get(id: string) {
      const { error, data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Get all campaigns for a user
    async getByUserId(userId: string) {
      const { error, data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('userId', userId);
      
      if (error) throw error;
      return data;
    },
    
    // Update a campaign
    async update(id: string, updates: any) {
      const { error, data } = await supabase
        .from('campaigns')
        .update({ ...updates, updatedAt: new Date() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    // Delete a campaign
    async delete(id: string) {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    }
  }
}; 