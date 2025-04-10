"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useCaterly } from "../app/context/caterly-context"
import { useAuth } from "../app/context/auth-context"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const { user: caterlyUser, setUser: setCaterlyUser } = useCaterly()
  const { user: authUser, signOut } = useAuth()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check authentication status on component mount and path changes
  useEffect(() => {
    // Set authentication status based on authUser from Supabase
    setIsAuthenticated(!!authUser)
    
    // If auth user exists but caterly user doesn't, set it
    if (authUser && !caterlyUser) {
      setCaterlyUser({
        name: authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
      })
    }
  }, [authUser, caterlyUser, setCaterlyUser, pathname])

  // Fetch the user's profile ID when the component mounts or path changes
  useEffect(() => {
    const fetchProfileId = async () => {
      if (!caterlyUser) return
      
      try {
        // Use fetch to get the profile ID since we're in a client component
        const response = await fetch('/api/profile/current', {
          credentials: 'include' // Include cookies in the request
        })
        const data = await response.json()
        
        if (data.profile?.id) {
          setProfileId(data.profile.id)
          console.log('Profile ID set in navbar:', data.profile.id)
        }
      } catch (error) {
        console.error('Error fetching profile ID:', error)
      }
    }
    
    fetchProfileId()
  }, [caterlyUser, pathname]) // Re-fetch when path changes to ensure we have the latest ID

  // Don't show navbar on landing page
  if (pathname === "/") return null

  const navItems = [
    {
      name: "Profile",
      path: profileId ? `/profile/${profileId}` : "/profile/setup", 
      hasDropdown: false
    },
    {
      name: "Marketing",
      path: "/marketing",
      hasDropdown: true,
      dropdownItems: [
        { 
          name: "AI Enhanced Profile", 
          path: profileId ? `/profile/${profileId}/ai-profile` : "/profile/setup"
        },
        // Future marketing items can be added here
      ],
    },
    { name: "Campaign", path: "/campaign/setup", hasDropdown: false },
    {
      name: "Leads",
      path: "/leads",
      hasDropdown: true,
      dropdownItems: [
        { name: "Discover", path: "/leads/discovery" },
        { name: "Enriched", path: "/leads/enriched" },
      ],
    },
    { name: "Launch", path: "/campaign/launch", hasDropdown: false },
    { name: "Dashboard", path: "/dashboard", hasDropdown: false },
  ]

  // Logout function
  const handleLogout = async () => {
    try {
      // Use the auth context signOut function directly
      await signOut();
      // Also clear Caterly context
      setCaterlyUser(null);
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  // Check if user has a profile
  const checkUserHasProfile = async () => {
    try {
      const response = await fetch('/api/profile/current', {
        credentials: 'include' // Include cookies in the request
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.authenticated && data.profile !== null;
    } catch (error) {
      console.error('Error checking if user has profile:', error);
      return false;
    }
  };

  return (
    <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="ai-icon">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-6 h-6 text-purple-500 dark:text-purple-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9" y2="9" />
                  <line x1="15" y1="9" x2="15" y2="9" />
                </svg>
              </span>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">CaterlyAI</span>
            </Link>

            <nav className="ml-10 hidden md:flex space-x-4">
              {navItems.map((item) => (
                item.hasDropdown ? (
                  <DropdownMenu key={item.path}>
                    <DropdownMenuTrigger className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center ${
                      pathname.includes(item.path) 
                        ? "bg-secondary text-primary shadow-ai-glow" 
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}>
                      {item.name} <ChevronDown className="ml-1 h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {item.dropdownItems?.map((dropdownItem) => (
                        <Link key={dropdownItem.path} href={dropdownItem.path}>
                          <DropdownMenuItem className={`${
                            pathname === dropdownItem.path 
                              ? "bg-secondary text-primary" 
                              : ""
                          }`}>
                            {dropdownItem.name}
                          </DropdownMenuItem>
                        </Link>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      pathname.includes(item.path) 
                        ? "bg-secondary text-primary shadow-ai-glow" 
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              ))}
            </nav>
          </div>

          <div className="flex items-center">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <ThemeToggle />
                <span className="text-sm font-medium">
                  {caterlyUser?.name || authUser?.email?.split('@')[0] || 'User'}
                </span>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <ThemeToggle />
                <Link href="/login">
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-ai-glow"
                  >
                    Login
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}