Act as a World-Class Staff Software Engineer, Software Architect, Product Designer, SaaS Founder, and Startup CTO.

Your mission is to design and build a complete Production-Ready SaaS MVP named "Dourak" (دورك).

Dourak is a real-time digital queue management platform for local businesses such as:

* Barbershops
* Clinics
* Restaurants
* Beauty Salons
* Car Washes

The platform is designed for the Algerian market first and should be architected to expand later across the Arab world.

==================================================
CRITICAL ARCHITECTURE REQUIREMENT
=================================

This is NOT a local demo.

This is NOT a single-device prototype.

This is NOT a BroadcastChannel application.

The system must work across multiple devices in real-world scenarios:

* Customer on smartphone
* Merchant on tablet
* Waiting screen on TV
* Administrator on laptop

All devices must stay synchronized in real time.

Supabase Realtime must be used.

Supabase PostgreSQL must be the single source of truth.

Never use LocalStorage as the primary data source.

LocalStorage may only be used for:

* session persistence
* remembering active ticket
* UI preferences

All queue data must live in PostgreSQL.

==================================================
TECH STACK
==========

Frontend:

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* shadcn/ui
* Framer Motion

Backend:

* Supabase

Required Supabase Features:

* PostgreSQL
* Realtime
* Authentication
* Row Level Security (RLS)
* Storage
* Edge Functions when needed

Deployment:

* Vercel

State Management:

* Zustand

Charts:

* Recharts

QR Code:

* Dynamic QR generation

Notifications:

* Browser Push Notifications
* In-app Notifications

==================================================
PRODUCT OVERVIEW
================

The goal is to eliminate physical waiting lines.

Customers join digitally and monitor their position in real time.

Merchants manage queues through a simple dashboard.

All updates must be reflected instantly across all devices.

==================================================
MULTI-TENANT SAAS ARCHITECTURE
==============================

This must be built as a real SaaS.

Requirements:

* Multi-business support
* Tenant isolation
* Subscription-ready architecture
* Secure access control
* Business-specific data isolation

Each business must only see its own queues, customers, analytics, and settings.

==================================================
CUSTOMER EXPERIENCE
===================

Customer scans a QR code.

No app download required.

Customer opens a mobile web page.

Customer enters:

* Name (required)
* Phone Number (optional)

Customer joins the queue.

Customer receives:

* Queue Number
* Position in Queue
* People Ahead
* Estimated Waiting Time
* Live Status Updates

All information updates automatically through Supabase Realtime.

If customer refreshes page:

* restore active ticket
* reconnect to realtime updates

==================================================
NOTIFICATION SYSTEM
===================

When only 2 customers remain ahead:

Display:

"تبقى شخصان فقط قبل دورك"

When only 1 customer remains ahead:

Display:

"استعد، دورك يقترب"

When it becomes their turn:

Display:

"حان دورك الآن"

Implement premium animated toast notifications.

Architecture should support future:

* WhatsApp Notifications
* SMS Notifications
* Push Notifications

==================================================
MERCHANT DASHBOARD
==================

Build a modern dashboard.

Features:

* Current Queue
* Active Customer
* Call Next Customer
* Skip Customer
* Remove Customer
* Complete Service
* Reset Daily Queue
* Search Customer
* Queue Status Overview

All actions update every connected device instantly.

==================================================
ANALYTICS
=========

Provide:

* Total Customers Today
* Active Customers
* Completed Customers
* Average Waiting Time
* Queue Abandonment Rate
* Peak Hours
* Daily Trends

Use professional charts and visualizations.

==================================================
WAITING SCREEN MODE
===================

Create a dedicated public display mode.

Designed for:

* TV Screens
* Tablets
* Monitors inside shops

Displays:

* Current Number
* Next Numbers
* Estimated Waiting Times

Updates automatically through Supabase Realtime.

==================================================
AI FEATURES
===========

Implement AI-ready architecture.

Phase 1:

Smart Wait Time Prediction

Use:

* historical queue data
* service duration
* queue length
* employee performance

Generate dynamic waiting estimates.

Phase 2:

AI Peak Hour Forecasting

Predict busy periods.

Phase 3:

AI Queue Optimization

Recommend operational improvements.

==================================================
DATABASE DESIGN
===============

Design production-grade PostgreSQL schema.

Tables:

* businesses
* profiles
* employees
* queues
* tickets
* customers
* notifications
* analytics
* subscriptions
* settings

Implement:

* indexes
* constraints
* optimized queries
* RLS policies
* foreign keys

==================================================
SECURITY
========

Implement:

* Authentication
* Authorization
* Secure API routes
* Tenant Isolation
* Input Validation
* Rate Limiting
* RLS
* Secure Realtime Channels

Security must be production-grade.

==================================================
UI / UX REQUIREMENTS
====================

Arabic First.

RTL mandatory.

Font:

* Cairo

Design Style:

* Premium SaaS
* Stripe-inspired
* Linear-inspired
* Minimal
* Modern
* Mobile-first

Requirements:

* Smooth animations
* Elegant spacing
* Glassmorphism effects
* Accessibility support
* Loading states
* Error states
* Empty states
* Skeleton loaders

The application should feel polished and startup-grade.

==================================================
PWA REQUIREMENTS
================

Implement as a Progressive Web App.

Requirements:

* Installable
* Mobile-app feel
* Offline shell
* App manifest
* Service Worker
* Push notification readiness

==================================================
OUTPUT REQUIREMENTS
===================

Before coding:

1. Analyze architecture.
2. Identify scalability risks.
3. Identify security risks.
4. Propose architecture improvements.

Then generate:

* Complete folder structure
* Database schema
* Supabase setup
* RLS policies
* Realtime architecture
* API architecture
* UI architecture
* Components
* Pages
* Production-ready implementation

Do not generate toy examples.

Do not generate placeholders.

Do not generate pseudo-code.

Generate production-grade SaaS architecture and implementation suitable for real businesses and real customers.
