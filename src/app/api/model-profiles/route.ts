/**
 * Model Profiles API Route
 * 
 * RESTful API endpoints for model profile management.
 * Handles GET (list), POST (create) operations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getModelProfiles, createModelProfile } from '../../actions/model-profiles'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const options = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      role: searchParams.get('role') || undefined,
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      search: searchParams.get('search') || undefined,
    }

    const result = await getModelProfiles(options)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Model profiles API GET error:', error)
    return NextResponse.json(
      { error: 'internal_server_error', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const result = await createModelProfile(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, message: result.message, details: result.details },
        { status: 400 }
      )
    }

    return NextResponse.json(result.data, { status: 201 })
  } catch (error) {
    console.error('Model profiles API POST error:', error)
    return NextResponse.json(
      { error: 'internal_server_error', message: 'Internal server error' },
      { status: 500 }
    )
  }
}
