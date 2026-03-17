/**
 * Model Profile API Route (by ID)
 * 
 * RESTful API endpoints for individual model profile operations.
 * Handles GET (read), PUT (update), DELETE operations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getModelProfile, updateModelProfile, deleteModelProfile } from '../../../actions/model-profiles'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getModelProfile(params.id)

    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 400
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Model profile API GET error:', error)
    return NextResponse.json(
      { error: 'internal_server_error', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const result = await updateModelProfile(params.id, body)

    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 400
      return NextResponse.json(
        { error: result.error, message: result.message, details: result.details },
        { status }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Model profile API PUT error:', error)
    return NextResponse.json(
      { error: 'internal_server_error', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await deleteModelProfile(params.id)

    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 400
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status }
      )
    }

    return NextResponse.json({ message: result.message })
  } catch (error) {
    console.error('Model profile API DELETE error:', error)
    return NextResponse.json(
      { error: 'internal_server_error', message: 'Internal server error' },
      { status: 500 }
    )
  }
}
